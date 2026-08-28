/**
 * Configurable episode cache + volatile merge tests.
 *
 * The episode list cache (what the Feed and My Shows pages show) is bounded by
 * the user's preference: a date window (default 60 days) or a count (default
 * 25). The full parse cache holds ALL episodes; fetch-more pages beyond the
 * bound from that cache (volatile — never written back). These tests pin:
 *   1. mergeEpisodesBounded unions refreshed episodes with what's in memory
 *      (fetched copy wins on id collision) and prunes by the supplied keep
 *      predicate (count or date). Undated episodes are always kept.
 *   2. The store bounds the visible list by the configured mode, but the
 *      full parse cache survives — fetch-more pages beyond the bound.
 *   3. Refresh merge never shrinks the in-memory list except via the bound.
 *
 * Clock constraint: these tests run under vi.useFakeTimers, and a LARGE
 * vi.advanceTimersByTime (past ~5 days of fake time) makes every subsequent
 * network fetch hang in Bun 1.3.8's fake-timer implementation. The date
 * boundary is pinned with relative pubDates, never by moving the clock.
 */

import { test, expect, beforeAll, afterAll, beforeEach, vi } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Point the config dir at a throwaway directory BEFORE importing the stores
// (their module-level init reads it).
const configHome = mkdtempSync(join(tmpdir(), "podtui-volatile-"));
process.env.XDG_CONFIG_HOME = configHome;

import { sameRefreshWindow, useFeedStore } from "../src/stores/feed";
import { mergeEpisodesBounded } from "../src/utils/episode-merge";
import { episodeInWindow } from "../src/utils/feeds-persistence";
import { useAppStore } from "../src/stores/app";
import type { Episode } from "../src/types/episode";
import type { Podcast } from "../src/types/podcast";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

interface ServedEpisode {
	title: string;
	date: string;
}

let server: ReturnType<typeof Bun.serve> | null = null;
let servedEpisodes: ServedEpisode[] = [];
const addedFeedIds: string[] = [];

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
	const store = useFeedStore();
	for (const id of addedFeedIds) store.removeFeed(id);
	server?.stop(true);
	rmSync(configHome, { recursive: true, force: true });
});

// ── mergeEpisodesBounded unit tests ──────────────────────────────────────

const NOW = new Date("2026-08-10T00:00:00Z");

test("mergeEpisodesBounded dedupes on id collision and keeps the fetched copy", () => {
	const existing = [
		makeEpisode("a", "Old Title", new Date("2026-08-01T00:00:00Z")),
		makeEpisode("b", "Ep B", new Date("2026-08-02T00:00:00Z")),
	];
	const fetched = [
		makeEpisode("a", "New Title", new Date("2026-08-01T00:00:00Z")),
	];
	const keepAll = () => true;

	const merged = mergeEpisodesBounded(existing, fetched, keepAll);

	expect(merged).toHaveLength(2);
	expect(merged.find((e) => e.id === "a")!.title).toBe("New Title");
});

test("mergeEpisodesBounded drops stale-id twins (id migration / rotating enclosure URLs)", () => {
	// The same two episodes with different ids on both sides — exactly what a
	// refresh sees after the positional-id → stable-id migration (or a host
	// that rotates signed audio URLs). Without content matching the union
	// would double every episode.
	const d1 = new Date("2026-08-01T00:00:00Z");
	const d2 = new Date("2026-08-02T00:00:00Z");
	const existing = [
		makeEpisode("feed#0", "Ep 1", d1),
		makeEpisode("feed#1", "Ep 2", d2),
	];
	const fetched = [
		makeEpisode("feed#guid:g1", "Ep 1", d1),
		makeEpisode("feed#guid:g2", "Ep 2", d2),
	];
	const keepAll = () => true;

	const merged = mergeEpisodesBounded(existing, fetched, keepAll);

	expect(merged.map((e) => e.id)).toEqual(["feed#guid:g2", "feed#guid:g1"]);
	expect(merged).toHaveLength(2);
});

test("mergeEpisodesBounded keeps an existing episode with no fetched twin (volatile window)", () => {
	// Fetched covers Ep 1 only (by content twin). Ep 2 exists only in memory
	// — the volatile window — and must survive the refresh.
	const d1 = new Date("2026-08-01T00:00:00Z");
	const d2 = new Date("2026-08-02T00:00:00Z");
	const existing = [
		makeEpisode("feed#0", "Ep 1", d1),
		makeEpisode("feed#1", "Ep 2", d2),
	];
	const fetched = [makeEpisode("feed#guid:g1", "Ep 1", d1)];
	const keepAll = () => true;

	const merged = mergeEpisodesBounded(existing, fetched, keepAll);

	expect(merged).toHaveLength(2);
	expect(merged.map((e) => e.title).sort()).toEqual(["Ep 1", "Ep 2"]);
});

test("sameRefreshWindow treats id drift with identical content as unchanged", () => {
	// Same episode, id changed between refreshes (migration / URL rotation):
	// the refresh must NOT bump lastUpdated or re-render.
	const d = new Date("2026-08-01T00:00:00Z");
	const existing = [makeEpisode("feed#0", "Ep 1", d)];
	const fetched = [makeEpisode("feed#guid:g1", "Ep 1", d)];
	expect(sameRefreshWindow(existing, fetched)).toBe(true);
});

test("sameRefreshWindow flags a genuinely new episode even when ids drift", () => {
	const d1 = new Date("2026-08-01T00:00:00Z");
	const d2 = new Date("2026-08-02T00:00:00Z");
	const existing = [makeEpisode("feed#0", "Ep 1", d1)];
	const fetched = [
		makeEpisode("feed#guid:g2", "Ep 2", d2),
		makeEpisode("feed#guid:g1", "Ep 1", d1),
	];
	expect(sameRefreshWindow(existing, fetched)).toBe(false);
});

test("mergeEpisodesBounded unions disjoint lists sorted newest-first", () => {
	const existing = [
		makeEpisode("old", "Old", new Date("2026-08-01T00:00:00Z")),
	];
	const fetched = [
		makeEpisode("newest", "Newest", new Date("2026-08-03T00:00:00Z")),
		makeEpisode("mid", "Mid", new Date("2026-08-02T00:00:00Z")),
	];
	const keepAll = () => true;

	const merged = mergeEpisodesBounded(existing, fetched, keepAll);

	expect(merged.map((e) => e.id)).toEqual(["newest", "mid", "old"]);
});

test("mergeEpisodesBounded with count keep drops oldest beyond the count", () => {
	const existing = [
		makeEpisode("day1", "Day 1", new Date("2026-08-01T00:00:00Z")),
	];
	const fetched = [
		makeEpisode("day3", "Day 3", new Date("2026-08-03T00:00:00Z")),
		makeEpisode("day2", "Day 2", new Date("2026-08-02T00:00:00Z")),
	];
	const keepCount2 = (_ep: Episode, i: number) => i < 2;

	const merged = mergeEpisodesBounded(existing, fetched, keepCount2);

	expect(merged.map((e) => e.id)).toEqual(["day3", "day2"]);
});

test("mergeEpisodesBounded with date keep drops out-of-window and keeps undated", () => {
	const existing = [
		makeEpisode("fresh", "Fresh", new Date("2026-08-09T00:00:00Z")),
		makeEpisode("stale", "Stale", new Date("2026-06-01T00:00:00Z")),
		makeEpisode("undated", "Undated", new Date(NaN)),
	];
	const fetched = [
		makeEpisode("newStale", "New Stale", new Date("2026-05-01T00:00:00Z")),
		makeEpisode("newFresh", "New Fresh", new Date("2026-08-08T00:00:00Z")),
	];
	// 30-day window from NOW (2026-08-10)
	const keepDate = (ep: Episode) => episodeInWindow(ep, NOW, 30);

	const merged = mergeEpisodesBounded(existing, fetched, keepDate);

	expect(merged.map((e) => e.id)).toEqual(["undated", "fresh", "newFresh"]);
});

test("mergeEpisodesBounded never mutates its inputs", () => {
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
	const keepAll = () => true;

	mergeEpisodesBounded(existing, fetched, keepAll);

	expect(existing.map((e) => e.id)).toEqual(existingIds);
	expect(existing.map((e) => e.title)).toEqual(existingTitles);
});

// ── store integration (default date mode, 60-day window) ─────────────────

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

test("date mode: episodes outside the 60-day window never enter the list", async () => {
	const store = useFeedStore();
	const now = Date.now();
	// 600 episodes at 2h spacing span ~50 days — all inside the 60-day default
	// window, so all 600 are cached and loadable (no count ceiling).
	servedEpisodes = Array.from({ length: 600 }, (_, i) => ({
		title: `Ep ${600 - i}`,
		date: new Date(now - i * 2 * HOUR).toISOString(),
	}));
	const feedUrl = `http://127.0.0.1:${server!.port}/date-all.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	expect(feed).not.toBeNull();
	const id = feed!.id;
	addedFeedIds.push(id);

	// Subscribe window (20) with more cached.
	expect(store.getFeed(id)!.episodes.length).toBe(20);

	// Load everything — the cache holds all 600 (date mode keeps them all).
	let iterations = 0;
	while (store.hasMoreEpisodes(id) && iterations < 20) {
		await store.loadMoreEpisodes(id);
		iterations++;
	}
	expect(store.hasMoreEpisodes(id)).toBe(false);
	expect(store.getFeed(id)!.episodes.length).toBe(600);
});

test("date mode: the 5 newest episodes load even outside the date window", async () => {
	const store = useFeedStore();
	const now = Date.now();
	servedEpisodes = [
		{ title: "In Window", date: new Date(now - 25 * DAY).toISOString() },
		{ title: "Out Window", date: new Date(now - 70 * DAY).toISOString() },
	];
	const feedUrl = `http://127.0.0.1:${server!.port}/date-boundary.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	expect(feed).not.toBeNull();
	const id = feed!.id;
	addedFeedIds.push(id);

	expect(store.getFeed(id)!.episodes.map((e) => e.title)).toEqual([
		"In Window",
		"Out Window",
	]);
	// The 70d episode is the second-newest available, so the min-5 floor
	// pulls it in despite the 60-day cache window.
	expect(store.hasMoreEpisodes(id)).toBe(false);
	await store.loadMoreEpisodes(id);
	expect(store.getFeed(id)!.episodes.map((e) => e.title)).toEqual([
		"In Window",
		"Out Window",
	]);
});

test("date mode: a dormant show (nothing in the window or next band) never fetch-mores", async () => {
	const store = useFeedStore();
	const now = Date.now();
	// Newest episode 100 days old, next 200 days old — both far outside the
	// 60-day cache window and the 14-day band past its edge.
	servedEpisodes = [
		{ title: "Old A", date: new Date(now - 100 * DAY).toISOString() },
		{ title: "Old B", date: new Date(now - 200 * DAY).toISOString() },
	];
	const feedUrl = `http://127.0.0.1:${server!.port}/dormant.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	expect(feed).not.toBeNull();
	const id = feed!.id;
	addedFeedIds.push(id);

	// The min-5 floor surfaces the show's only 2 episodes; it still cannot
	// fetch-more (nothing further exists to load).
	expect(store.getFeed(id)!.episodes.length).toBe(2);
	expect(store.hasMoreEpisodes(id)).toBe(false);
	await store.loadMoreEpisodes(id);
	expect(store.getFeed(id)!.episodes.length).toBe(2);
});

test("date mode: episodes just outside the window load via the band anchored at the window edge", async () => {
	const store = useFeedStore();
	const now = Date.now();
	// Both episodes are outside the 60-day window (61d / 65d); the min-5
	// floor loads them at subscribe time regardless.
	servedEpisodes = [
		{ title: "Just Out A", date: new Date(now - 61 * DAY).toISOString() },
		{ title: "Just Out B", date: new Date(now - 65 * DAY).toISOString() },
	];
	const feedUrl = `http://127.0.0.1:${server!.port}/just-out.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	expect(feed).not.toBeNull();
	const id = feed!.id;
	addedFeedIds.push(id);

	// The min-5 floor loads both out-of-window episodes immediately.
	expect(store.getFeed(id)!.episodes.length).toBe(2);
	expect(store.hasMoreEpisodes(id)).toBe(false);
	await store.loadMoreEpisodes(id);
	expect(store.getFeed(id)!.episodes.map((e) => e.title)).toEqual([
		"Just Out A",
		"Just Out B",
	]);
});

// ── count mode ────────────────────────────────────────────────────────────

test("date mode: fetch-more steps by a two-week window, not a count", async () => {
	const store = useFeedStore();
	const now = Date.now();
	// 30 episodes at 3-day spacing span 87 days. The 60-day cache window
	// holds the first 21 (subscribe shows 20); fetch-more then reveals the
	// next 2-week band per press — 3-day cadence → ~4 episodes per band —
	// NOT a fixed 50-episode chunk (which would load all 30 at once).
	servedEpisodes = Array.from({ length: 30 }, (_, i) => ({
		title: `Ep ${30 - i}`,
		date: new Date(now - i * 3 * DAY).toISOString(),
	}));
	const feedUrl = `http://127.0.0.1:${server!.port}/date-step.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	expect(feed).not.toBeNull();
	const id = feed!.id;
	addedFeedIds.push(id);

	expect(store.getFeed(id)!.episodes.length).toBe(20);

	// Press 1: oldest loaded is 57d old → cutoff 71d → i=20..23 (60–69d).
	await store.loadMoreEpisodes(id);
	expect(store.getFeed(id)!.episodes.length).toBe(24);
	expect(store.hasMoreEpisodes(id)).toBe(true);

	// Press 2: oldest loaded is 69d old → cutoff 83d → i=24..27 (72–81d).
	await store.loadMoreEpisodes(id);
	expect(store.getFeed(id)!.episodes.length).toBe(28);
	expect(store.hasMoreEpisodes(id)).toBe(true);

	// Press 3: oldest loaded is 81d old → cutoff 95d → i=28..29 (84–87d).
	await store.loadMoreEpisodes(id);
	expect(store.getFeed(id)!.episodes.length).toBe(30);
	expect(store.hasMoreEpisodes(id)).toBe(false);
});

test("count mode: only N most-recent episodes are visible, but fetch-more goes beyond", async () => {
	const store = useFeedStore();
	const app = useAppStore();
	// The app store loads persisted prefs asynchronously at import — wait so
	// the override below isn't clobbered by the load.
	await app.whenReady();
	app.updatePreferences({ episodeCacheMode: "count", episodeCacheCount: 25 });

	const now = Date.now();
	// 50 episodes at 1h spacing — all recent, but count mode caps at 25.
	servedEpisodes = Array.from({ length: 50 }, (_, i) => ({
		title: `Ep ${50 - i}`,
		date: new Date(now - i * HOUR).toISOString(),
	}));
	const feedUrl = `http://127.0.0.1:${server!.port}/count.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	expect(feed).not.toBeNull();
	const id = feed!.id;
	addedFeedIds.push(id);

	// Subscribe window (20), but the cache holds all 50 — count mode only
	// bounds the visible list (25), but the full parse cache is unbounded.
	// The subscribe window returns min(20, 25) = 20.
	expect(store.getFeed(id)!.episodes.length).toBe(20);
	expect(store.hasMoreEpisodes(id)).toBe(true);

	// Fetch more: the visible list grows beyond the count bound — these
	// episodes are volatile (held in feed.episodes, not extending the cache).
	while (store.hasMoreEpisodes(id)) {
		await store.loadMoreEpisodes(id);
	}
	expect(store.getFeed(id)!.episodes.length).toBe(50);

	// Reset to date mode for subsequent tests.
	app.updatePreferences({ episodeCacheMode: "date" });
});

test("count mode: Feed list is a GLOBAL top-N that grows N per press, never a far-back dump", async () => {
	const store = useFeedStore();
	const app = useAppStore();
	// Wait out the async pref load (see the single-show count test).
	await app.whenReady();
	app.updatePreferences({ episodeCacheMode: "count", episodeCacheCount: 25 });

	const now = Date.now();
	// Feed A: 200 episodes at 1-day spacing (ages 0–199d). Feed B: 200 at
	// 1-day spacing shifted 200 days older (ages 200–399d) — every A episode
	// is newer than every B episode, so the global top-K is deterministic.
	const serve = (prefix: string, shiftDays: number) =>
		Array.from({ length: 200 }, (_, i) => ({
			title: `${prefix} Ep ${200 - i}`,
			date: new Date(now - (shiftDays + i) * DAY).toISOString(),
		}));
	servedEpisodes = serve("A", 0);
	const aUrl = `http://127.0.0.1:${server!.port}/global-a.xml`;
	const a = await store.addFeed(makePodcast(aUrl), "test-source");
	expect(a).not.toBeNull();
	const aId = a!.id;
	addedFeedIds.push(aId);
	servedEpisodes = serve("B", 200);
	const bUrl = `http://127.0.0.1:${server!.port}/global-b.xml`;
	const b = await store.addFeed(makePodcast(bUrl), "test-source");
	expect(b).not.toBeNull();
	const bId = b!.id;
	addedFeedIds.push(bId);

	// The Feed page's global list is capped at the configured count (25),
	// NOT 20 per show (the union would be 40).
	expect(store.getAllEpisodesChronological().length).toBe(25);

	// Press 1: cap grows to 50 AND every feed's window deepens by 25 — the
	// list reveals exactly the next 25 most-recent episodes (A's 25 more),
	// not 25 from every show.
	await store.loadMoreAllFeeds();
	expect(store.getAllEpisodesChronological().length).toBe(50);
	expect(store.getFeed(aId)!.episodes.length).toBe(45);
	expect(store.getFeed(bId)!.episodes.length).toBe(45);
	expect(store.hasMoreAcrossAll()).toBe(true);

	// Press 2: cap grows to 75.
	await store.loadMoreAllFeeds();
	expect(store.getAllEpisodesChronological().length).toBe(75);

	// Keep pressing until every cache is exhausted. The global cap stays
	// (never lifts — rendering the full deep union froze the UI), so the
	// Feed list stays at count×(presses+1) = 25×9 = 225 while the per-show
	// windows hold everything.
	let guard = 0;
	while (store.hasMoreAcrossAll() && guard++ < 30) {
		await store.loadMoreAllFeeds();
	}
	expect(guard).toBeLessThan(30);
	expect(store.hasMoreAcrossAll()).toBe(false);
	expect(store.getFeed(aId)!.episodes.length).toBe(200);
	expect(store.getFeed(bId)!.episodes.length).toBe(200);
	expect(store.getAllEpisodesChronological().length).toBe(225);

	// Reset to date mode for subsequent tests.
	app.updatePreferences({ episodeCacheMode: "date" });
});
