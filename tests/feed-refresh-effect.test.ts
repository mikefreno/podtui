/**
 * Feed-refresh Effect program tests (src/effects/feed-refresh.ts).
 *
 * These test the Effect program in isolation — no store singleton, no
 * network, no fake timers. The fetch/apply closures are injected, and the
 * `Clock` service comes from TestContext's TestClock, so timeouts are driven
 * deterministically with TestClock.adjust instead of real 20s waits.
 *
 * Contracts pinned here (mirrored at the store level by
 * feed-nonblocking.test.ts / feed-refresh.test.ts against a real Bun.serve):
 *   1. Bounded concurrency — never more than `concurrency` fetches in
 *      flight, and the pool pulls the next feed as one completes.
 *   2. Per-feed apply as its own fetch lands (no barrier).
 *   3. A timed-out fetch leaves that feed untouched and does not stall the
 *      batch (TestClock.adjust fires the timeout deterministically).
 *   4. A rejecting fetch leaves that feed untouched and does not fail the
 *      batch.
 */

import { test, expect } from "bun:test"
import { Duration, Effect, Fiber, TestClock, TestContext } from "effect"
import {
	refreshFeedsBatch,
	type RefreshFetchResult,
} from "../src/effects/feed-refresh"
import type { Feed } from "../src/types/feed"
import type { Podcast } from "../src/types/podcast"
import type { Episode } from "../src/types/episode"

const makePodcast = (id: string): Podcast => ({
	id,
	title: `Show ${id}`,
	description: `Show ${id} description`,
	feedUrl: `http://example.com/${id}.xml`,
	lastUpdated: new Date(0),
	isSubscribed: true,
})

const makeFeed = (id: string): Feed => ({
	id,
	podcast: makePodcast(id),
	episodes: [],
	visibility: "public" as Feed["visibility"],
	sourceId: "test",
	lastUpdated: new Date(0),
	isPinned: false,
})

const makeEpisode = (id: string): Episode => ({
	id,
	podcastId: "pod",
	title: `Ep ${id}`,
	description: "",
	audioUrl: `https://example.com/${id}.mp3`,
	duration: 60,
	pubDate: new Date(0),
})

/** Resolve an episode result without dragging in the full RSS shape. */
const ok = (episodeIds: string[]): RefreshFetchResult => ({
	episodes: episodeIds.map(makeEpisode),
	coverUrl: undefined,
})

/** One macrotask turn — lets microtask-scheduled Effect fibers run. */
const tick = (): Promise<void> => {
	const { promise, resolve } = Promise.withResolvers<void>()
	setImmediate(resolve)
	return promise
}

/** A resolvable fetch gate: the pool parks on `promise` until the test
 *  resolves it. (Promise.withResolvers's return type is not in tsconfig's
 *  ES2015.Promise lib, hence the explicit shape.) */
interface Gate {
	promise: Promise<RefreshFetchResult>
	resolve: (value: RefreshFetchResult) => void
}

/** Poll `cond` across up to `iterations` event-loop turns. */
async function pollUntil(
	cond: () => boolean,
	iterations = 500,
): Promise<boolean> {
	for (let i = 0; i < iterations; i++) {
		if (cond()) return true
		await tick()
	}
	return cond()
}

test("bounds in-flight fetches to the configured concurrency", async () => {
	const feeds = Array.from({ length: 10 }, (_, i) => makeFeed(`feed-${i}`))
	let inFlight = 0
	let maxInFlight = 0
	const gates: Gate[] = []
	const applied: string[] = []

	const program = refreshFeedsBatch(
		feeds,
		(feed) => {
			inFlight++
			if (inFlight > maxInFlight) maxInFlight = inFlight
			const gate = Promise.withResolvers<RefreshFetchResult>()
			gates.push(gate)
			return gate.promise.finally(() => {
				inFlight--
			})
		},
		(feed) => {
			applied.push(feed.id)
		},
		{ concurrency: 4, timeoutMs: 60_000 },
	)

	// Run the batch in flight (NOT awaited) and observe the pool from
	// outside via the gate side effects.
	const done = Effect.runPromise(program)
	// The pool starts exactly `concurrency` fetches up front.
	const sawStart = await pollUntil(() => gates.length >= 4)
	expect(sawStart).toBe(true)
	expect(maxInFlight).toBe(4)
	expect(gates.length).toBe(4)

	// Resolve one gate: the pool pulls the next feed, still bounded at 4.
	gates[0].resolve(ok(["a"]))
	const sawPull = await pollUntil(() => gates.length >= 5)
	expect(sawPull).toBe(true)
	expect(maxInFlight).toBeLessThanOrEqual(4)

	// Release everything, re-draining as the pool pulls new gates, until
	// every feed has been fetched and applied.
	while (applied.length < 10) {
		for (const gate of gates.splice(0)) gate.resolve(ok(["x"]))
		await tick()
	}
	await done
	expect(maxInFlight).toBeLessThanOrEqual(4)
	expect(applied).toHaveLength(10)
})

test("applies each feed as its own fetch lands (no barrier)", async () => {
	const a = makeFeed("a")
	const b = makeFeed("b")
	const applied: string[] = []
	let bCalled = false
	const gateB = Promise.withResolvers<RefreshFetchResult>()

	const program = refreshFeedsBatch(
		[a, b],
		(feed) => {
			if (feed.id === "a") return Promise.resolve(ok(["a-1"]))
			bCalled = true
			return gateB.promise
		},
		(feed) => {
			applied.push(feed.id)
		},
		{ concurrency: 4, timeoutMs: 60_000 },
	)

	// Run the batch in flight; A's fetch resolves and applies while B's is
	// still parked at the gate.
	const done = Effect.runPromise(program)
	const aApplied = await pollUntil(() => applied.includes("a"))
	expect(aApplied).toBe(true)
	expect(bCalled).toBe(true)
	expect(applied).toEqual(["a"])
	expect(applied).not.toContain("b")

	gateB.resolve(ok(["b-1"]))
	await done
	expect(applied).toEqual(["a", "b"])
})

test("a timed-out fetch leaves that feed untouched, without stalling the batch", async () => {
	const fast = makeFeed("fast")
	const hung = makeFeed("hung")
	const applied: string[] = []
	// A promise that never settles — the fetch hangs past the timeout.
	const never = new Promise<RefreshFetchResult>(() => {})

	const program = refreshFeedsBatch(
		[fast, hung],
		(feed) =>
			feed.id === "fast"
				? Promise.resolve(ok(["f-1"]))
				: never,
		(feed) => {
			applied.push(feed.id)
		},
		{ concurrency: 4, timeoutMs: 5_000 },
	)

	const timed = Effect.gen(function* () {
		const fiber = yield* Effect.fork(program)
		// Advance the TestClock past the timeout: the hung fetch's
		// Effect.timeout fires deterministically — no real 5s wait.
		yield* TestClock.adjust(Duration.millis(5_000))
		yield* Fiber.join(fiber)
	})
	await Effect.runPromise(
		timed.pipe(Effect.provide(TestContext.TestContext)),
	)

	// The fast feed applied; the hung one was dropped, and the batch
	// completed anyway.
	expect(applied).toEqual(["fast"])
})

test("a rejecting fetch leaves that feed untouched and does not fail the batch", async () => {
	const bad = makeFeed("bad")
	const good = makeFeed("good")
	const applied: string[] = []

	const program = refreshFeedsBatch(
		[bad, good],
		(feed) =>
			feed.id === "bad"
				? Promise.reject(new Error("feed exploded"))
				: Promise.resolve(ok(["g-1"])),
		(feed) => {
			applied.push(feed.id)
		},
		{ concurrency: 4, timeoutMs: 60_000 },
	)

	await Effect.runPromise(program)
	expect(applied).toEqual(["good"])
})
