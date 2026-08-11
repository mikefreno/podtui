/**
 * Unsubscribed-show download tests — the download store contract behind the
 * "Unsubscribed Show Downloads" list (My Shows depth 0 and the settings
 * Download Manager):
 *
 *   1. startUnsubscribedDownload records the episode under a deterministic
 *      synthetic feed id with the show's metadata, and
 *      getUnsubscribedDownloads lists it.
 *   2. A download made under a real (subscribed) feed id is NOT listed as
 *      unsubscribed.
 *   3. Subscribing to the show re-classifies its unsubscribed download into
 *      the subscribed group — it drops out of getUnsubscribedDownloads.
 *   4. removeDownloadsForFeed with the show's feed URL removes that show's
 *      unsubscribed downloads too (unsubscribing purges search downloads).
 *
 * Served over a real local HTTP server, mirroring how the app's other store
 * tests exercise the network path. The store singleton is shared with other
 * test files, so every added feed/download is removed in afterAll.
 */

import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Point the config/data dirs at throwaway directories BEFORE importing the
// stores (their module-level init reads them).
const configHome = mkdtempSync(join(tmpdir(), "podtui-unsubdl-"));
process.env.XDG_CONFIG_HOME = configHome;
const dataHome = mkdtempSync(join(tmpdir(), "podtui-unsubdl-data-"));
process.env.XDG_DATA_HOME = dataHome;

import { useDownloadStore } from "../src/stores/download";
import { useFeedStore } from "../src/stores/feed";
import type { Episode } from "../src/types/episode";
import type { Podcast } from "../src/types/podcast";

let server: ReturnType<typeof Bun.serve> | null = null;
let audioUrl = "";
const addedFeedIds: string[] = [];
const addedEpisodeIds: string[] = [];

/** Minimal RSS feed for one show. */
function feedXml(title: string, origin: string): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${title}</title>
<description>Test feed</description>
<item>
<title>Ep 1</title>
<pubDate>2026-08-01T00:00:00Z</pubDate>
<enclosure url="${origin}/audio.mp3" length="12345" type="audio/mpeg"/>
</item>
</channel></rss>`;
}

const makeEpisode = (id: string, title: string): Episode => ({
	id,
	podcastId: "pod",
	title,
	description: "",
	audioUrl,
	duration: 0,
	pubDate: new Date("2026-08-01T00:00:00Z"),
});

const makePodcast = (feedUrl: string, title: string): Podcast => ({
	id: `dir-${title}`,
	title,
	description: "Test feed",
	author: "tester",
	feedUrl,
	lastUpdated: new Date(),
	isSubscribed: false,
});

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		fetch(req) {
			const url = new URL(req.url);
			if (url.pathname.endsWith(".xml")) {
				return new Response(feedXml("Test Show", url.origin), {
					headers: { "Content-Type": "application/rss+xml" },
				});
			}
			return new Response("audio bytes", {
				headers: { "Content-Type": "audio/mpeg" },
			});
		},
	});
	audioUrl = `http://127.0.0.1:${server!.port}/audio.mp3`;
});

afterAll(() => {
	for (const id of addedEpisodeIds) {
		const dl = useDownloadStore();
		dl.cancelDownload(id);
		dl.removeDownload(id).catch(() => {});
	}
	for (const id of addedFeedIds) {
		useFeedStore().removeFeed(id);
	}
	server?.stop(true);
	rmSync(configHome, { recursive: true, force: true });
	rmSync(dataHome, { recursive: true, force: true });
});

test("startUnsubscribedDownload records a synthetic-feed download with show metadata", () => {
	const dl = useDownloadStore();
	const episode = makeEpisode("unsub-ep-1", "Ep 1");
	const podcast = makePodcast("https://example.com/feed.xml", "Unsub Show");
	addedEpisodeIds.push(episode.id);

	dl.startUnsubscribedDownload(episode, podcast);

	const listed = dl.getUnsubscribedDownloads();
	const mine = listed.find((d) => d.episodeId === episode.id);
	expect(mine).toBeDefined();
	expect(mine!.feedId).toBe("unsub-https-example-com-feed-xml");
	expect(mine!.podcastTitle).toBe("Unsub Show");
	expect(mine!.podcastFeedUrl).toBe("https://example.com/feed.xml");
	expect(mine!.episodeTitle).toBe("Ep 1");
});

test("downloads under a real feed id are not listed as unsubscribed", async () => {
	const feedStore = useFeedStore();
	const dl = useDownloadStore();
	const feedUrl = `http://127.0.0.1:${server!.port}/subbed.xml`;
	const feed = await feedStore.addFeed(makePodcast(feedUrl, "Subbed"), "test");
	expect(feed).not.toBeNull();
	addedFeedIds.push(feed!.id);

	const episode = makeEpisode("subbed-ep-1", "Ep 1");
	addedEpisodeIds.push(episode.id);
	dl.startDownload(episode, feed!.id);

	expect(dl.getUnsubscribedDownloads().some((d) => d.episodeId === episode.id)).toBe(
		false,
	);
});

test("subscribing to the show re-classifies its unsubscribed download", async () => {
	const feedStore = useFeedStore();
	const dl = useDownloadStore();
	const feedUrl = `http://127.0.0.1:${server!.port}/later.xml`;
	const episode = makeEpisode("unsub-ep-later", "Ep 1");
	const podcast = makePodcast(feedUrl, "Later Show");
	addedEpisodeIds.push(episode.id);

	// Downloaded while unsubscribed.
	dl.startUnsubscribedDownload(episode, podcast);
	expect(dl.getUnsubscribedDownloads().some((d) => d.episodeId === episode.id)).toBe(
		true,
	);

	// Subscribing later (same feed URL) moves it into the subscribed group.
	const feed = await feedStore.addFeed(podcast, "test");
	expect(feed).not.toBeNull();
	addedFeedIds.push(feed!.id);
	expect(dl.getUnsubscribedDownloads().some((d) => d.episodeId === episode.id)).toBe(
		false,
	);
});

test("removeDownloadsForFeed purges the show's unsubscribed downloads by feed URL", async () => {
	const feedStore = useFeedStore();
	const dl = useDownloadStore();
	const feedUrl = `http://127.0.0.1:${server!.port}/purge.xml`;
	const episode = makeEpisode("unsub-ep-purge", "Ep 1");
	addedEpisodeIds.push(episode.id);

	dl.startUnsubscribedDownload(episode, makePodcast(feedUrl, "Purge Show"));
	expect(dl.getUnsubscribedDownloads().some((d) => d.episodeId === episode.id)).toBe(
		true,
	);

	// Unsubscribe the show: the feed is gone, but its URL still identifies
	// the search downloads made while it was unsubscribed.
	await dl.removeDownloadsForFeed("no-such-feed-id", feedUrl);
	expect(dl.getAllDownloads().some((d) => d.episodeId === episode.id)).toBe(false);
});
