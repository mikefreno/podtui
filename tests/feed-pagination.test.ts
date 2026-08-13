/**
 * Per-feed pagination test — the store contract behind the "[Fetch More]"
 * row in a drilled show's episode list (My Shows depth 1) and the Feed
 * page's row.
 *
 * Runs in COUNT cache mode: `loadMoreEpisodes` advances the loaded window in
 * fixed MAX_EPISODES_REFRESH (50) chunks until the cache is exhausted.
 * (Date-mode fetch-more steps by a two-week window instead — that contract
 * is pinned in feed-volatile-merge.test.ts.) This pins:
 *   1. A freshly subscribed feed with a longer cache reports hasMoreEpisodes.
 *   2. loadMoreEpisodes grows that feed's episodes from the cache (no refetch
 *      needed) and hasMoreEpisodes flips false once the window reaches the end.
 *   3. loadMoreEpisodes past the end is a no-op (the feed is untouched).
 */

import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Point the config dir at a throwaway directory BEFORE importing the stores
// (their module-level init reads it).
const configHome = mkdtempSync(join(tmpdir(), "podtui-pagination-"));
process.env.XDG_CONFIG_HOME = configHome;

import { useFeedStore } from "../src/stores/feed";
import { useAppStore } from "../src/stores/app";
import type { Podcast } from "../src/types/podcast";

const HOUR = 3600 * 1000;

interface ServedEpisode {
	title: string;
	date: string;
}

let server: ReturnType<typeof Bun.serve> | null = null;
let servedEpisodes: ServedEpisode[] = [];
// Bun runs test files in ONE process, so the store singleton is shared with
// feed-refresh.test.ts / feedless-subscribe.test.ts. Track the feeds we add
// and remove them in afterAll so whichever file runs next sees a pristine
// store (execution order between files is not guaranteed).
const addedFeedIds: string[] = [];

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
<title>Paged Show</title>
<description>Pagination test feed</description>
${items}
</channel></rss>`;
}

const makePodcast = (feedUrl: string): Podcast => ({
	id: feedUrl,
	title: "Paged Show",
	description: "Pagination test feed",
	author: "tester",
	feedUrl,
	lastUpdated: new Date(),
	isSubscribed: true,
});

beforeAll(async () => {
	// The app store loads its persisted prefs asynchronously at import; wait
	// for that so our count-mode override isn't clobbered by the load.
	await useAppStore().whenReady();
	// Chunk-based stepping is count-mode behavior (see header comment).
	useAppStore().updatePreferences({
		episodeCacheMode: "count",
		episodeCacheCount: 25,
	});
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

afterAll(() => {
	// Leave the shared singleton as we found it (see addedFeedIds note).
	useAppStore().updatePreferences({ episodeCacheMode: "date" });
	const store = useFeedStore();
	for (const id of addedFeedIds) store.removeFeed(id);
	server?.stop(true);
	rmSync(configHome, { recursive: true, force: true });
});

test("loadMoreEpisodes advances one feed's window from the cache, then no-ops", async () => {
	const store = useFeedStore();
	// 60 episodes: 20 shown at subscribe, 40 held back in the cache. All
	// inside the lifecycle window (11h apart ≈ 27.5 days) so every one is
	// cacheable — the cache bound is the date window, not a count.
	servedEpisodes = Array.from({ length: 60 }, (_, i) => ({
		title: `Ep ${60 - i}`,
		date: new Date(Date.now() - (60 - i) * 11 * HOUR).toISOString(),
	}));
	const feedUrl = `http://127.0.0.1:${server!.port}/paged.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	expect(feed).not.toBeNull();
	const id = feed!.id;
	addedFeedIds.push(id);

	// Subscribe window (MAX_EPISODES_SUBSCRIBE = 20) with more cached.
	expect(store.getFeed(id)!.episodes.length).toBe(20);
	expect(store.hasMoreEpisodes(id)).toBe(true);

	// One load-more covers the remaining 40 (20 + 50 >= 60).
	await store.loadMoreEpisodes(id);
	expect(store.getFeed(id)!.episodes.length).toBe(60);
	expect(store.hasMoreEpisodes(id)).toBe(false);

	// Exhausted: loadMoreEpisodes is a no-op — the feed object is untouched.
	const before = store.getFeed(id)!;
	await store.loadMoreEpisodes(id);
	expect(store.getFeed(id)).toBe(before);
});

test("hasMoreEpisodes stays true across chunked loads until the end", async () => {
	const store = useFeedStore();
	// 120 episodes: 20 shown, 100 cached — two 50-episode chunks remaining.
	// All inside the lifecycle window (5h apart = 25 days).
	servedEpisodes = Array.from({ length: 120 }, (_, i) => ({
		title: `Ep ${120 - i}`,
		date: new Date(Date.now() - (120 - i) * 5 * HOUR).toISOString(),
	}));
	const feedUrl = `http://127.0.0.1:${server!.port}/paged-chunked.xml`;
	const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
	expect(feed).not.toBeNull();
	const id = feed!.id;
	addedFeedIds.push(id);

	await store.loadMoreEpisodes(id);
	expect(store.getFeed(id)!.episodes.length).toBe(70);
	expect(store.hasMoreEpisodes(id)).toBe(true);

	await store.loadMoreEpisodes(id);
	expect(store.getFeed(id)!.episodes.length).toBe(120);
	expect(store.hasMoreEpisodes(id)).toBe(false);
});
