/**
 * Non-blocking feed refresh tests — task 03 of the bounded-feed-lifecycle
 * feature.
 *
 * Pins the contracts that make a refresh batch feel non-blocking:
 *
 *   1. refreshAllFeeds never holds more than FETCH_CONCURRENCY (4) RSS
 *      requests in flight — a worker pool bounds the batch instead of
 *      Promise.all firing every feed at once.
 *   2. Each feed's refreshed episodes are applied AS ITS OWN FETCH LANDS —
 *      the old Promise.all barrier is gone, so a slow feed no longer hides
 *      the fast feeds' fresh episodes.
 *   3. config.json writes are trailing-edge debounced (rapid changes
 *      collapse into one final write) and flushPendingSave() persists
 *      immediately, without waiting out the debounce window.
 *
 * Polling note (why the polls below use setImmediate, not microtasks):
 * vi's fake timers trap setTimeout/setInterval/Date/Bun.sleep, so the
 * debounce is driven with vi.advanceTimersByTime. But a poll loop of pure
 * microtask turns (`await Promise.resolve()`) can NEVER observe an
 * in-flight refresh: it keeps the microtask queue non-empty, the event
 * loop's poll phase is never reached, and Bun.serve never even receives
 * the fetch (verified empirically). setImmediate is a real macrotask that
 * fake timers do NOT trap, and it lets the socket I/O progress — each
 * `tick()` below is one bounded event-loop turn. No real sleeps anywhere.
 */

import { test, expect, beforeAll, afterAll, beforeEach, vi } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Point the config dir at a throwaway directory BEFORE importing the stores
// (their module-level init reads it).
const configHome = mkdtempSync(join(tmpdir(), "podtui-nonblocking-"));
process.env.XDG_CONFIG_HOME = configHome;

import { useFeedStore } from "../src/stores/feed";
import type { Podcast } from "../src/types/podcast";
import { whenConfigIdle } from "../src/utils/config";

interface ServedEpisode {
	title: string;
	date: string;
}

let server: ReturnType<typeof Bun.serve> | null = null;
let servedEpisodes: ServedEpisode[] = [];

/** Per-pathname request gates: while a path has an unresolved gate, the
 *  server parks that request until the test resolves it. */
let gates = new Map<string, { gate: Promise<void>; resolve: () => void }>();
/** Requests currently inside the fetch handler (entered, not yet answered). */
let inFlight = 0;
/** High-water mark of `inFlight` — the concurrency-bound assertion source. */
let maxConcurrent = 0;

// Bun runs test files in ONE process, so the store singleton is shared with
// other test files. Track the feeds we add and remove them in afterAll so
// whichever file runs next sees a pristine store.
const addedFeedIds: string[] = [];
/** Feed created by the debounce test, reused by the flushPendingSave test. */
let debounceFeedId = "";

/** XML for the current served episode list (episode ids derive from enclosure URLs). */
function feedXml(episodes: ServedEpisode[], origin: string): string {
	const items = episodes
		.map(
			(ep, i) => `<item>
	<title>${ep.title}</title>
	<pubDate>${ep.date}</pubDate>
	<enclosure url="${origin}/audio-${i}.mp3" length="12345" type="audio/mpeg"/>
</item>`,
		)
		.join("\n");
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Non-Blocking Test Show</title>
<description>Non-blocking refresh test feed</description>
${items}
</channel></rss>`;
}

const makePodcast = (feedUrl: string): Podcast => ({
	id: feedUrl,
	title: "Non-Blocking Test Show",
	description: "Non-blocking refresh test feed",
	author: "tester",
	feedUrl,
	lastUpdated: new Date(),
	isSubscribed: true,
});

/** Park a request path behind an unresolved gate. */
function setGate(path: string): void {
	const { promise, resolve } = Promise.withResolvers<void>();
	gates.set(path, { gate: promise, resolve });
}

/** Resolve every gate currently set. */
function releaseAllGates(): void {
	for (const { resolve } of gates.values()) resolve();
	gates.clear();
}

/** One real macrotask turn — see the polling note in the header. */
const tick = (): Promise<void> => {
	const { promise, resolve } = Promise.withResolvers<void>();
	setImmediate(resolve);
	return promise;
};

/** Poll `cond` across up to `iterations` event-loop turns (one setImmediate
 *  each). Returns whether the condition held by the deadline. */
async function pollUntil(
	cond: () => boolean,
	iterations = 500,
): Promise<boolean> {
	for (let i = 0; i < iterations; i++) {
		if (cond()) return true;
		await tick();
	}
	return cond();
}

/** Raw config.json text ("" when the file does not exist yet). */
const readConfigRaw = (): Promise<string> =>
	Bun.file(join(process.env.XDG_CONFIG_HOME!, "podtui", "config.json"))
		.text()
		.catch(() => "");

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		async fetch(req) {
			const url = new URL(req.url);
			inFlight++;
			if (inFlight > maxConcurrent) maxConcurrent = inFlight;
			try {
				const gate = gates.get(url.pathname);
				if (gate) await gate.gate;
				if (url.pathname.endsWith(".xml")) {
					return new Response(feedXml(servedEpisodes, url.origin), {
						headers: { "Content-Type": "application/rss+xml" },
					});
				}
				return new Response("not found", { status: 404 });
			} finally {
				inFlight--;
			}
		},
	});
});

beforeEach(() => {
	vi.useFakeTimers();
	gates.clear();
	inFlight = 0;
	maxConcurrent = 0;
});

afterAll(() => {
	vi.useRealTimers();
	const store = useFeedStore();
	for (const id of addedFeedIds) store.removeFeed(id);
	server?.stop(true);
	rmSync(configHome, { recursive: true, force: true });
});

test("refreshAllFeeds never exceeds FETCH_CONCURRENCY in-flight requests", async () => {
	const store = useFeedStore();
	servedEpisodes = [{ title: "Bound Ep 0", date: "2026-08-10T00:00:00Z" }];
	const urls = Array.from(
		{ length: 10 },
		(_, n) => `http://127.0.0.1:${server!.port}/bound-${n}.xml`,
	);
	const ids: string[] = [];
	for (const url of urls) {
		const feed = await store.addFeed(makePodcast(url), "test-source");
		expect(feed).not.toBeNull();
		ids.push(feed!.id);
		addedFeedIds.push(feed!.id);
	}

	// Gate every path so the batch's requests pile up at the server. addFeed
	// ran sequentially above (its own fetches never exceed 1 in flight), so
	// the counter below measures the batch alone.
	for (const url of urls) setGate(new URL(url).pathname);
	inFlight = 0;
	maxConcurrent = 0;

	const refreshPromise = store.refreshAllFeeds(); // NOT awaited
	const sawBound = await pollUntil(() => maxConcurrent >= 4);
	expect(sawBound).toBe(true);
	// The worker pool caps the batch at 4 — exactly 4 gated requests are
	// parked (nothing has been released, so nothing completed yet), and
	// nothing may exceed the bound, now or as the batch drains.
	expect(maxConcurrent).toBe(4);
	expect(maxConcurrent).toBeLessThanOrEqual(4);

	releaseAllGates();
	await refreshPromise;
	expect(maxConcurrent).toBeLessThanOrEqual(4);
	for (const id of ids) {
		expect(store.getFeed(id)!.episodes.length).toBe(1);
	}
});

test("refreshAllFeeds applies each feed as its own fetch lands (no barrier)", async () => {
	const store = useFeedStore();
	servedEpisodes = [{ title: "Incr Ep 0", date: "2026-08-10T00:00:00Z" }];
	const aUrl = `http://127.0.0.1:${server!.port}/incr-a.xml`;
	const bUrl = `http://127.0.0.1:${server!.port}/incr-b.xml`;
	const a = await store.addFeed(makePodcast(aUrl), "test-source");
	const b = await store.addFeed(makePodcast(bUrl), "test-source");
	expect(a).not.toBeNull();
	expect(b).not.toBeNull();
	const aId = a!.id;
	const bId = b!.id;
	addedFeedIds.push(aId, bId);

	// A new episode appears for both feeds; B's fetch is parked at the
	// server, A's is not.
	servedEpisodes = [
		{ title: "Incr Ep 0", date: "2026-08-10T00:00:00Z" },
		{ title: "Incr Ep 1", date: "2026-08-09T00:00:00Z" },
	];
	setGate(new URL(bUrl).pathname);

	const beforeA = store.getFeed(aId)!.lastUpdated.getTime();
	const beforeB = store.getFeed(bId)!.lastUpdated.getTime();
	// Advance the (mocked) clock so the refresh's `new Date()` lastUpdated
	// bump is observably greater than beforeA (the fake clock otherwise
	// never moves — same pattern as feed-refresh.test.ts).
	vi.advanceTimersByTime(60_000);
	const refreshPromise = store.refreshAllFeeds(); // NOT awaited

	const applied = await pollUntil(
		() => store.getFeed(aId)!.lastUpdated.getTime() > beforeA,
	);
	expect(applied).toBe(true);
	// A's refreshed window is visible in feeds() while B is STILL gated —
	// the proof that per-feed results apply as they land.
	expect(store.getFeed(aId)!.episodes.length).toBe(2);
	expect(store.getFeed(bId)!.episodes.length).toBe(1);
	expect(store.getFeed(bId)!.lastUpdated.getTime()).toBe(beforeB);

	releaseAllGates();
	await refreshPromise;
	expect(store.getFeed(aId)!.episodes.length).toBe(2);
	expect(store.getFeed(bId)!.episodes.length).toBe(2);
});

test("config.json writes are trailing-edge debounced (two refreshes, one save)", async () => {
	const store = useFeedStore();
	servedEpisodes = [{ title: "Deb Ep 0", date: "2026-08-10T00:00:00Z" }];
	const url = `http://127.0.0.1:${server!.port}/debounce.xml`;
	const feed = await store.addFeed(makePodcast(url), "test-source");
	expect(feed).not.toBeNull();
	debounceFeedId = feed!.id;
	addedFeedIds.push(debounceFeedId);

	servedEpisodes = [
		{ title: "Deb Ep 0", date: "2026-08-10T00:00:00Z" },
		{ title: "Deb Ep 1", date: "2026-08-09T00:00:00Z" },
	];
	await store.refreshFeed(debounceFeedId);

	servedEpisodes = [
		{ title: "Deb Ep 0", date: "2026-08-10T00:00:00Z" },
		{ title: "Deb Ep 1", date: "2026-08-09T00:00:00Z" },
		{ title: "Deb Ep 2", date: "2026-08-08T00:00:00Z" },
	];
	await store.refreshFeed(debounceFeedId);
	expect(store.getFeed(debounceFeedId)!.episodes.length).toBe(3);

	// No timer advanced: the debounced saves have NOT fired — the refreshed
	// episodes exist only in memory (await whenConfigIdle first so a
	// straggler write from an earlier test cannot race this read).
	await whenConfigIdle();
	const before = await readConfigRaw();
	expect(before).not.toContain("Deb Ep 1");
	expect(before).not.toContain("Deb Ep 2");

	// SAVE_DEBOUNCE_MS = 250 (module-private in feed.ts — hardcoded here).
	vi.advanceTimersByTime(250);
	await whenConfigIdle();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	await whenConfigIdle();

	// One read, both refreshed episodes: the two refreshes collapsed into a
	// single trailing-edge write.
	const after = await readConfigRaw();
	expect(after).toContain("Deb Ep 1");
	expect(after).toContain("Deb Ep 2");
});

test("flushPendingSave persists immediately, without waiting out the debounce", async () => {
	const store = useFeedStore();
	// Same feed as the debounce test (still in the singleton): serve a 4th
	// episode and refresh — the save is scheduled, then flushed by hand.
	servedEpisodes = [
		{ title: "Deb Ep 0", date: "2026-08-10T00:00:00Z" },
		{ title: "Deb Ep 1", date: "2026-08-09T00:00:00Z" },
		{ title: "Deb Ep 2", date: "2026-08-08T00:00:00Z" },
		{ title: "Deb Ep 3", date: "2026-08-07T00:00:00Z" },
	];
	await store.refreshFeed(debounceFeedId);
	expect(store.getFeed(debounceFeedId)!.episodes.length).toBe(4);

	// No advanceTimersByTime: flushPendingSave must write right now.
	store.flushPendingSave();
	await whenConfigIdle();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	await whenConfigIdle();

	const raw = await readConfigRaw();
	expect(raw).toContain("Deb Ep 3");
});
