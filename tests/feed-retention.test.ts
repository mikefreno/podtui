/**
 * Bounded-feed-lifecycle persistence tests — task 01 (retention window).
 *
 * Pins the persistence contract:
 *   1. saveFeedsToFile never writes an episode older than PERSISTED_WINDOW_DAYS
 *      unless its id is a completed download in downloads.json.
 *   2. loadFeedsFromFile prunes over-window episodes from legacy configs and
 *      rewrites config.json when it pruned anything.
 *   3. Undatable episodes (missing/invalid pubDate) are always persisted.
 *
 * The async saveFeedsToFile IIFE reads downloads.json then enqueues an
 * updateConfig write on the serialized write chain, so assertions wait via
 * whenConfigIdle() + a short real-timer settle (no fake timers here — see
 * settleWrites).
 */

import { test, expect, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Point the config dir at a throwaway directory BEFORE importing anything
// under test (config-dir reads XDG_CONFIG_HOME lazily, but stay consistent
// with the store test harness). Do NOT import the feed store — its module
// boot IIFE would hit the network.
const configHome = mkdtempSync(join(tmpdir(), "podtui-retention-"));
process.env.XDG_CONFIG_HOME = configHome;

import {
	PERSISTED_WINDOW_DAYS,
	episodeIsPersistable,
	loadFeedsFromFile,
	saveFeedsToFile,
} from "../src/utils/feeds-persistence";
import { whenConfigIdle } from "../src/utils/config";
import { FeedVisibility } from "../src/types/feed";
import type { Feed } from "../src/types/feed";
import type { Episode } from "../src/types/episode";

const configJsonPath = join(configHome, "podtui", "config.json");
const downloadsJsonPath = join(configHome, "podtui", "downloads.json");

/** Milliseconds in one day — mirrors the window math in feeds-persistence. */
const DAY = 24 * 3600 * 1000;

function makeEpisode(partial: Partial<Episode> & { id: string }): Episode {
	return {
		podcastId: "feed-1",
		title: partial.id,
		description: "",
		audioUrl: `https://example.com/audio/${partial.id}.mp3`,
		duration: 600,
		pubDate: new Date(),
		...partial,
	};
}

function makeFeed(episodes: Episode[]): Feed {
	return {
		id: "feed-1",
		podcast: {
			id: "feed-1",
			title: "Retention Show",
			description: "Retention test feed",
			author: "tester",
			feedUrl: "https://example.com/feed.xml",
			lastUpdated: new Date(),
			isSubscribed: true,
		},
		episodes,
		visibility: FeedVisibility.PUBLIC,
		sourceId: "source-1",
		lastUpdated: new Date(),
		isPinned: false,
	};
}

function delay(ms: number): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	setTimeout(resolve, ms);
	return promise;
}

/**
 * Wait for the fire-and-forget save chain to drain. saveFeedsToFile's IIFE is
 * not awaitable: it reads downloads.json first and only THEN enqueues its
 * write on the serialized chain, so the first whenConfigIdle() may observe
 * the chain BEFORE the write is queued. A real-timer settle is the only way
 * to let the IIFE's async read land without fake timers (which would stall
 * the Bun.file I/O and the write chain itself); the poll fallback in the
 * assertions absorbs any residual scheduling skew on a loaded machine.
 */
async function settleWrites(): Promise<void> {
	await whenConfigIdle();
	await delay(20);
	await whenConfigIdle();
}

/** Episode ids of the first feed in config.json, or null when absent. */
async function readPersistedEpisodeIds(): Promise<string[] | null> {
	const raw = await Bun.file(configJsonPath).json().catch(() => null);
	if (!raw || typeof raw !== "object" || !("feeds" in raw)) return null;
	const feeds = raw.feeds;
	if (!Array.isArray(feeds) || feeds.length === 0) return null;
	const first = feeds[0];
	if (!first || typeof first !== "object" || !("episodes" in first)) return null;
	const episodes = first.episodes;
	if (!Array.isArray(episodes)) return null;
	return episodes.map((ep) => {
		if (ep && typeof ep === "object" && "id" in ep) return String(ep.id);
		return "";
	});
}

/** Wait (up to ~1s) until config.json's first feed has exactly these ids. */
async function pollConfigFor(ids: string[]): Promise<void> {
	const expected = [...ids].sort().join(",");
	const deadline = Date.now() + 1000;
	for (;;) {
		const actual = (await readPersistedEpisodeIds())?.sort().join(",");
		if (actual === expected) return;
		if (Date.now() > deadline) {
			throw new Error(
				`config.json never reached expected episode ids [${ids.join(", ")}]`,
			);
		}
		await delay(20);
	}
}

afterAll(() => {
	rmSync(configHome, { recursive: true, force: true });
});

// ── Unit: episodeIsPersistable ──────────────────────────────────────────────

test("episodeIsPersistable drops a 40-day-old episode that is not downloaded", () => {
	const ep = makeEpisode({
		id: "old-plain-id",
		pubDate: new Date(Date.now() - 40 * DAY),
	});
	expect(episodeIsPersistable(ep, new Set(), new Date())).toBe(false);
});

test("episodeIsPersistable keeps a 40-day-old episode whose id is a completed download", () => {
	const ep = makeEpisode({
		id: "old-downloaded-id",
		pubDate: new Date(Date.now() - 40 * DAY),
	});
	expect(
		episodeIsPersistable(ep, new Set(["old-downloaded-id"]), new Date()),
	).toBe(true);
});

test("episodeIsPersistable keeps a 5-day-old episode", () => {
	const ep = makeEpisode({
		id: "recent-id",
		pubDate: new Date(Date.now() - 5 * DAY),
	});
	expect(episodeIsPersistable(ep, new Set(), new Date())).toBe(true);
});

test("episodeIsPersistable keeps an episode with an invalid pubDate", () => {
	const ep = makeEpisode({ id: "undatable-id", pubDate: new Date(NaN) });
	expect(episodeIsPersistable(ep, new Set(), new Date())).toBe(true);
});

test("PERSISTED_WINDOW_DAYS is 30", () => {
	expect(PERSISTED_WINDOW_DAYS).toBe(30);
});

// ── Save path: retention window applied with completed-download exemption ──

test("saveFeedsToFile prunes over-window episodes but keeps completed downloads", async () => {
	// Arrange: downloads.json lists one completed download.
	mkdirSync(join(configHome, "podtui"), { recursive: true });
	await Bun.write(
		downloadsJsonPath,
		JSON.stringify([
			{
				episodeId: "old-downloaded-id",
				feedId: "feed-1",
				status: "completed",
				filePath: null,
				downloadedAt: null,
				fileSize: 0,
				error: null,
				audioUrl: "",
				episodeTitle: "",
			},
		]),
	);

	// Act: recent episode, old plain episode, old downloaded episode.
	const feed = makeFeed([
		makeEpisode({
			id: "recent-id",
			pubDate: new Date(Date.now() - 5 * DAY),
		}),
		makeEpisode({
			id: "old-plain-id",
			pubDate: new Date(Date.now() - 40 * DAY),
		}),
		makeEpisode({
			id: "old-downloaded-id",
			pubDate: new Date(Date.now() - 40 * DAY),
		}),
	]);
	saveFeedsToFile([feed]);
	await settleWrites();
	// The IIFE's downloads.json read can land after the first settle; poll
	// briefly in case the write chain drained before that read resolved.
	await pollConfigFor(["old-downloaded-id", "recent-id"]);

	// Assert: persisted episodes keep recent + downloaded, drop old-plain.
	const persisted = await readPersistedEpisodeIds();
	expect(persisted).toContain("recent-id");
	expect(persisted).toContain("old-downloaded-id");
	expect(persisted).not.toContain("old-plain-id");
});

// ── Load path: legacy config cleanup rewrite ───────────────────────────────

test("loadFeedsFromFile prunes over-window episodes and rewrites config.json", async () => {
	// Arrange: seed config.json directly with a feed whose episodes are ALL
	// older than the window; no downloads.json present.
	mkdirSync(join(configHome, "podtui"), { recursive: true });
	await Bun.write(
		configJsonPath,
		JSON.stringify(
			{
				feeds: [
					{
						id: "feed-1",
						podcast: {
							id: "feed-1",
							title: "Legacy Show",
							description: "",
							author: "tester",
							feedUrl: "https://example.com/legacy.xml",
							lastUpdated: new Date(Date.now() - 1 * DAY).toISOString(),
							isSubscribed: true,
						},
						episodes: [
							{
								id: "old-a",
								podcastId: "feed-1",
								title: "Old A",
								description: "",
								audioUrl: "https://example.com/audio/old-a.mp3",
								duration: 60,
								pubDate: new Date(Date.now() - 40 * DAY).toISOString(),
							},
							{
								id: "old-b",
								podcastId: "feed-1",
								title: "Old B",
								description: "",
								audioUrl: "https://example.com/audio/old-b.mp3",
								duration: 60,
								pubDate: new Date(Date.now() - 40 * DAY).toISOString(),
							},
						],
						visibility: "public",
						sourceId: "source-1",
						lastUpdated: new Date(Date.now() - 1 * DAY).toISOString(),
						isPinned: false,
					},
				],
			},
			null,
			2,
		),
	);

	// Act.
	const feeds = await loadFeedsFromFile();
	await settleWrites();

	// Assert: returned feed has zero episodes AND config.json was rewritten
	// (the cleanup save is fire-and-forget — poll for the rewritten file).
	expect(feeds).toHaveLength(1);
	expect(feeds[0].episodes).toHaveLength(0);
	await pollConfigFor([]);
	expect(await readPersistedEpisodeIds()).toEqual([]);
});
