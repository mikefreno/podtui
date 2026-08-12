/**
 * Volatile in-memory episode merge + bounded cache tests.
 *
 * Two behaviors from the bounded-feed-lifecycle work:
 *   1. mergeEpisodes unions refreshed episodes with what's already in memory
 *      (the fetched copy wins on id collision), so a refresh never shrinks
 *      the session's visible window; the union is capped per feed at
 *      MAX_EPISODES_IN_MEMORY.
 *   2. The per-feed parse cache is capped at MAX_EPISODES_IN_MEMORY, so
 *      loadMoreEpisodes can never surface more than the cap and
 *      hasMoreEpisodes flips false there.
 *
 * Unchanged-refresh detection compares the fetched window against the
 * corresponding PREFIX of the merged list (sameRefreshWindow) — comparing
 * full lists would bump lastUpdated on every refresh because the merged list
 * legitimately holds episodes beyond the fetched window.
 */

import { test, expect, beforeAll, afterAll, beforeEach, vi } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Point the config dir at a throwaway directory BEFORE importing the stores
// (their module-level init reads it).
const configHome = mkdtempSync(join(tmpdir(), "podtui-volatile-"));
process.env.XDG_CONFIG_HOME = configHome;

import { MAX_EPISODES_IN_MEMORY, useFeedStore } from "../src/stores/feed";
import { mergeEpisodes } from "../src/utils/episode-merge";
import type { Episode } from "../src/types/episode";
import type { Podcast } from "../src/types/podcast";

interface ServedEpisode {
	title: string;
	date: string;
}

let server: ReturnType<typeof Bun.serve> | null = null;
let servedEpisodes: ServedEpisode[] = [];
// Bun runs test files in ONE process, so the store singleton is shared with
// the other feed test files. Track the feeds we add and remove them in
// afterAll so whichever file runs next sees a pristine store (execution
// order between files is not guaranteed).
const addedFeedIds: string[] = [];

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
<title>Volatile Show</title>
<description>Volatile merge test feed</description>
${items}
</channel></rss>`;
}

const makePodcast = (feedUrl: string): Podcast => ({
	id: feedUrl,
	title: "Volatile Show",
	description: "Volatile merge test feed",
	author: "tester",
	feedUrl,
	lastUpdated: new Date(),
	isSubscribed: true,
});

const makeEpisode = (id: string, title: string, pubDate: Date): Episode => ({
	id,
	podcastId: "pod",
	title,
	description: "",
	audioUrl: `https://example.com/${id}.mp3`,
	duration: 100,
	pubDate,
});

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		fetch(req) {
			const url = new URL(req.url);
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
	// Leave the shared singleton as we found it (see addedFeedIds note).
	const store = useFeedStore();
	for (const id of addedFeedIds) store.removeFeed(id);
	server?.stop(true);
	rmSync(configHome, { recursive: true, force: true });
});

// ── mergeEpisodes unit tests ─────────────────────────────────────────────

test("mergeEpisodes dedupes on id collision and keeps the fetched copy", () => {
	const existing = [
		makeEpisode("a", "Old Title", new Date("2026-08-01T00:00:00Z")),
		makeEpisode("b", "Ep B", new Date("2026-08-02T00:00:00Z")),
	];
	const fetched = [
		makeEpisode("a", "New Title", new Date("2026-08-01T00:00:00Z")),
	];

	const merged = mergeEpisodes(existing, fetched, 10);

	expect(merged).toHaveLength(2);
	expect(merged.find((e) => e.id === "a")!.title).toBe("New Title");
});

test("mergeEpisodes unions disjoint lists sorted newest-first", () => {
	const existing = [
		makeEpisode("old", "Old", new Date("2026-08-01T00:00:00Z")),
	];
	const fetched = [
		makeEpisode("newest", "Newest", new Date("2026-08-03T00:00:00Z")),
		makeEpisode("mid", "Mid", new Date("2026-08-02T00:00:00Z")),
	];

	const merged = mergeEpisodes(existing, fetched, 10);

	expect(merged.map((e) => e.id)).toEqual(["newest", "mid", "old"]);
});

test("mergeEpisodes drops the oldest episodes past the cap", () => {
	const existing = [
		makeEpisode("day1", "Day 1", new Date("2026-08-01T00:00:00Z")),
	];
	const fetched = [
		makeEpisode("day3", "Day 3", new Date("2026-08-03T00:00:00Z")),
		makeEpisode("day2", "Day 2", new Date("2026-08-02T00:00:00Z")),
	];

	const merged = mergeEpisodes(existing, fetched, 2);

	expect(merged.map((e) => e.id)).toEqual(["day3", "day2"]);
});

test("mergeEpisodes never mutates its inputs", () => {
	const existing = [
		makeEpisode("a", "A", new Date("2026-08-01T00:00:00Z")),
		makeEpisode("b", "B", new Date("2026-08-02T00:00:00Z")),
	];
	const fetched = [
		makeEpisode("a", "A (fetched)", new Date("2026-08-01T00:00:00Z")),
		makeEpisode("c", "C", new Date("2026-08-03T00:00:00Z")),
	];
	const existingIds = existing.map((e) => e.id);
	const existingTitles = existing.map((e) => e.title);
	const fetchedIds = fetched.map((e) => e.id);
	const fetchedTitles = fetched.map((e) => e.title);

	mergeEpisodes(existing, fetched, 10);

	expect(existing.map((e) => e.id)).toEqual(existingIds);
	expect(existing.map((e) => e.title)).toEqual(existingTitles);
	expect(fetched.map((e) => e.id)).toEqual(fetchedIds);
	expect(fetched.map((e) => e.title)).toEqual(fetchedTitles);
});

// ── store integration ────────────────────────────────────────────────────

test("refresh merges new episodes without removing the volatile window", async () => {
	const store = useFeedStore();
	servedEpisodes = [
		{ title: "Ep 3", date: "2026-08-03T00:00:00Z" },
		{ title: "Ep 2", date: "2026-08-02T00:00:00Z" },
		{ title: "Ep 1", date: "2026-08-01T00:00:00Z" },
	];
	const feedUrl = `http://127.0.0.1:${server!.port}/volatile.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	expect(feed).not.toBeNull();
	const id = feed!.id;
	addedFeedIds.push(id);
	expect(store.getFeed(id)!.episodes.length).toBe(3);
	const beforeUpdated = store.getFeed(id)!.lastUpdated.getTime();

	// The feed now serves the same 3 episodes plus 2 newer ones (new ids at
	// item indices 3 and 4).
	servedEpisodes = [
		{ title: "Ep 3", date: "2026-08-03T00:00:00Z" },
		{ title: "Ep 2", date: "2026-08-02T00:00:00Z" },
		{ title: "Ep 1", date: "2026-08-01T00:00:00Z" },
		{ title: "Ep 5", date: "2026-08-05T00:00:00Z" },
		{ title: "Ep 4", date: "2026-08-04T00:00:00Z" },
	];

	vi.advanceTimersByTime(60_000);
	await store.refreshFeed(id);

	const afterFirst = store.getFeed(id)!;
	expect(afterFirst.episodes.length).toBe(5);
	expect(afterFirst.lastUpdated.getTime()).toBeGreaterThan(beforeUpdated);

	// Identical second refresh: no lastUpdated bump, object identity kept.
	vi.advanceTimersByTime(60_000);
	await store.refreshFeed(id);

	const afterSecond = store.getFeed(id)!;
	expect(afterSecond).toBe(afterFirst);
	expect(afterSecond.lastUpdated.getTime()).toBe(afterFirst.lastUpdated.getTime());
});

test("cached episodes are capped at MAX_EPISODES_IN_MEMORY", async () => {
	const store = useFeedStore();
	servedEpisodes = Array.from({ length: 600 }, (_, i) => ({
		title: `Ep ${600 - i}`,
		date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
	}));
	const feedUrl = `http://127.0.0.1:${server!.port}/huge.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	expect(feed).not.toBeNull();
	const id = feed!.id;
	addedFeedIds.push(id);

	// Subscribe window (MAX_EPISODES_SUBSCRIBE = 20) with 480 more cached.
	expect(store.getFeed(id)!.episodes.length).toBe(20);

	// Load in MAX_EPISODES_REFRESH chunks until the cache is exhausted.
	let maxLoaded = 0;
	let iterations = 0;
	while (store.hasMoreEpisodes(id) && iterations < 20) {
		await store.loadMoreEpisodes(id);
		maxLoaded = Math.max(maxLoaded, store.getFeed(id)!.episodes.length);
		iterations++;
	}

	expect(iterations).toBeLessThan(20);
	expect(store.hasMoreEpisodes(id)).toBe(false);
	expect(store.getFeed(id)!.episodes.length).toBe(MAX_EPISODES_IN_MEMORY);
	expect(maxLoaded).toBeLessThanOrEqual(MAX_EPISODES_IN_MEMORY);
});
