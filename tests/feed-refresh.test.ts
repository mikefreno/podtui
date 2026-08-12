/**
 * Feed refresh order-stability regression test.
 *
 * My Shows / Feed sort by `lastUpdated` ("updated") by default, and every
 * refresh bumped it unconditionally — so a startup refresh-all re-sorted the
 * list once per feed as each fetch landed (order flapping until the batch
 * finished). These tests pin the contract:
 *
 *   1. A refresh that fetches identical episodes does NOT bump lastUpdated —
 *      the feed object is untouched, so the list cannot reorder.
 *   2. A refresh that fetches genuinely new episodes DOES bump lastUpdated.
 *   3. refreshAllFeeds applies one atomic update: unchanged feeds keep their
 *      order and timestamps after a full refresh.
 *
 * The clock is mocked (fake timers) so the "did lastUpdated advance?" checks
 * are deterministic — no real sleeps that would race under load.
 */

import { test, expect, beforeAll, afterAll, beforeEach, vi } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Point the config dir at a throwaway directory BEFORE importing the stores
// (their module-level init reads it).
const configHome = mkdtempSync(join(tmpdir(), "podtui-refresh-"));
process.env.XDG_CONFIG_HOME = configHome;

import { useFeedStore } from "../src/stores/feed";
import type { Podcast } from "../src/types/podcast";

interface ServedEpisode {
	title: string;
	date: string;
}

let server: ReturnType<typeof Bun.serve> | null = null;
let servedEpisodes: ServedEpisode[] = [];
let feedAId = "";
/** When set, the server 503s this path — simulates a feed going down. */
let failPath: string | null = null;

/** XML for the current served episode list (episode ids = feedUrl#index). */
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
<title>Test Show</title>
<description>Regression test feed</description>
${items}
</channel></rss>`;
}

const makePodcast = (feedUrl: string): Podcast => ({
	id: feedUrl,
	title: "Test Show",
	description: "Regression test feed",
	author: "tester",
	feedUrl,
	lastUpdated: new Date(),
	isSubscribed: true,
});

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		fetch(req) {
			const url = new URL(req.url);
			if (failPath && url.pathname === failPath) {
				return new Response("feed unavailable", { status: 503 });
			}
			if (url.pathname.endsWith(".xml")) {
				return new Response(feedXml(servedEpisodes, url.origin), {
					headers: { "Content-Type": "application/rss+xml" },
				});
			}
			return new Response("not found", { status: 404 });
		},
	});
});

beforeEach(() => {
	vi.useFakeTimers();
});

afterAll(() => {
	vi.useRealTimers();
	server?.stop(true);
	rmSync(configHome, { recursive: true, force: true });
});

test("refresh with identical episodes does not bump lastUpdated", async () => {
	const store = useFeedStore();
	servedEpisodes = [
		{ title: "Ep 3", date: "2026-08-03T00:00:00Z" },
		{ title: "Ep 2", date: "2026-08-02T00:00:00Z" },
		{ title: "Ep 1", date: "2026-08-01T00:00:00Z" },
	];
	const feedUrl = `http://127.0.0.1:${server!.port}/show-a.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	expect(feed).not.toBeNull();
	feedAId = feed!.id;

	const before = store.getFeed(feedAId)!;
	const beforeUpdated = before.lastUpdated.getTime();

	// Advance the (mocked) clock, then refresh with identical content.
	vi.advanceTimersByTime(60_000);
	await store.refreshFeed(feedAId);

	const after = store.getFeed(feedAId)!;
	expect(after).toBe(before); // same object: no update applied at all
	expect(after.lastUpdated.getTime()).toBe(beforeUpdated);
	expect(after.episodes.length).toBe(3);
});

test("refresh with a genuinely new episode bumps lastUpdated", async () => {
	const store = useFeedStore();
	servedEpisodes.push({ title: "Ep 0 (new)", date: "2026-08-04T00:00:00Z" });

	const before = store.getFeed(feedAId)!.lastUpdated.getTime();
	vi.advanceTimersByTime(60_000);
	await store.refreshFeed(feedAId);

	const after = store.getFeed(feedAId)!;
	expect(after.lastUpdated.getTime()).toBeGreaterThan(before);
	expect(after.episodes.length).toBe(4);
});

test("a failed refresh does not wipe the feed's episodes", async () => {
	const store = useFeedStore();
	const savedEpisodes = servedEpisodes;
	servedEpisodes = [{ title: "Ep 1", date: "2026-08-01T00:00:00Z" }];
	const feedUrl = `http://127.0.0.1:${server!.port}/flaky.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	expect(feed).not.toBeNull();
	const feedId = feed!.id;
	expect(store.getFeed(feedId)!.episodes.length).toBe(1);

	// The feed now 503s. fetchEpisodes returns null, and both refresh paths
	// must leave the loaded episodes untouched — a failed refresh must never
	// look like an empty feed (which would wipe the show's episodes).
	failPath = "/flaky.xml";
	vi.advanceTimersByTime(60_000);
	await store.refreshFeed(feedId);
	expect(store.getFeed(feedId)!.episodes.length).toBe(1);

	vi.advanceTimersByTime(60_000);
	await store.refreshAllFeeds();
	expect(store.getFeed(feedId)!.episodes.length).toBe(1);

	failPath = null;
	store.removeFeed(feedId);
	// Restore the shared served content: with union merge semantics (volatile
	// episodes survive refreshes) this feed keeps its larger in-memory window,
	// so later tests must serve the same episodes they added — a shrink here
	// would make the next test's "unchanged" refresh genuinely different.
	servedEpisodes = savedEpisodes;
});

test("refreshAllFeeds keeps unchanged feeds' order and timestamps", async () => {
	const store = useFeedStore();
	// Feed B: distinct URL, identical served content, so refreshing it is a
	// no-op too.
	const feedBUrl = `http://127.0.0.1:${server!.port}/show-b.xml`;
	const feedB = await store.addFeed(makePodcast(feedBUrl), "test-source");
	expect(feedB).not.toBeNull();
	const feedBId = feedB!.id;

	const orderBefore = store.getFilteredFeeds().map((f) => f.id);
	const tsBefore: Record<string, number> = {};
	for (const id of [feedAId, feedBId]) {
		tsBefore[id] = store.getFeed(id)!.lastUpdated.getTime();
	}

	vi.advanceTimersByTime(60_000);
	await store.refreshAllFeeds();

	expect(store.getFilteredFeeds().map((f) => f.id)).toEqual(orderBefore);
	for (const id of [feedAId, feedBId]) {
		expect(store.getFeed(id)!.lastUpdated.getTime()).toBe(tsBefore[id]);
	}
});

test("refresh parses in bounded chunks, yielding to the event loop between them", async () => {
	const store = useFeedStore();
	// 60 episodes: a chunked parse (25/chunk) must yield between chunks; a
	// monolithic parse would complete without yielding at all.
	servedEpisodes = Array.from({ length: 60 }, (_, i) => ({
		title: `Ep ${60 - i}`,
		date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
	}));
	const feedUrl = `http://127.0.0.1:${server!.port}/chunky.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	const feedId = feed!.id;
	expect(store.getFeed(feedId)!.episodes.length).toBe(20); // subscribe window

	// Count event-loop yields during the refresh: each parse-chunk boundary
	// posts through a MessageChannel (the yield primitive in feed.ts — the
	// one macrotask turn bun's fake timers do not trap, which also pins that
	// the yield works under fake timers). This runs under fake timers like
	// the other tests; a setTimeout-based yield would deadlock here.
	const OriginalMessageChannel = globalThis.MessageChannel;
	let posts = 0;
	globalThis.MessageChannel = class extends OriginalMessageChannel {
		constructor() {
			super();
			posts++;
		}
	};
	try {
		vi.advanceTimersByTime(60_000);
		await store.refreshFeed(feedId);
	} finally {
		globalThis.MessageChannel = OriginalMessageChannel;
	}

	expect(posts).toBeGreaterThan(0);
	expect(store.getFeed(feedId)!.episodes.length).toBe(50); // refresh window

	// Leave the shared singleton as we found it (see the addedFeedIds note
	// in feed-pagination.test.ts — bun runs test files in one process).
	store.removeFeed(feedId);
});
