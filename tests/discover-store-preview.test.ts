/**
 * discover-store-preview.test.ts — the Discover episode-preview store API.
 *
 * `openEpisodes` fetches a show's RSS feed WITHOUT subscribing (drill-in from
 * a podcast result), caches it per podcast id for the session, records a
 * per-show error on failure, and never refetches while cached or in flight.
 * `refreshEpisodes` clears the cache/error and refetches.
 *
 * The REAL feed store runs against a local RSS server. No `mock.module`:
 * bun test reuses workers across files and module mocks leak into the shared
 * registry, so a feed-store mock here (whose stub lacks addFeed/refreshFeed/
 * isLoadingFeeds) breaks every later file that shares a worker — the suite's
 * documented failure mode. The repo's defense is importing the REAL modules
 * via a query-suffixed specifier, which `mock.module` does not intercept.
 */

import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Podcast } from "../src/types/podcast";

// Point the config dir at a throwaway directory BEFORE importing the stores
// (their module-level init reads it).
const configHome = mkdtempSync(join(tmpdir(), "podtui-discprev-"));
process.env.XDG_CONFIG_HOME = configHome;

// Query-suffixed module identity: loads the REAL discover store even when a
// sibling file's `mock.module("../src/stores/discover")` leaked into this
// worker. Its internal `./feed` import resolves the real feed store, which
// no file mocks anymore.
// @ts-expect-error — bun-only query suffix: distinct module identity that
// loads the real file instead of a leaked mock.module from another test file.
const { useDiscoverStore } = await import("../src/stores/discover?discover-store-preview");

interface ServedEpisode {
	title: string;
	date: string;
}

/** Pathnames the local server has served, in order (fetch tracking). */
const requests: string[] = [];
/** Per-path episode lists served by the local server. */
const served: Record<string, ServedEpisode[]> = {};
/** When set, responses for this path wait on the release callback. */
let gatePath: string | null = null;
let releaseGate: (() => void) | null = null;

/** XML for one show's episode list (ids derive from enclosure URLs). */
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
<description>Discover preview test feed</description>
${items}
</channel></rss>`;
}

let server: Bun.Server<undefined> | null = null;
let origin = "";

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		async fetch(req) {
			const url = new URL(req.url);
			requests.push(url.pathname);
			if (gatePath && url.pathname === gatePath) {
				await new Promise<void>((resolve) => {
					releaseGate = resolve;
				});
			}
			// A permanently-failing feed (simulates a show that went down).
			if (url.pathname === "/fail.xml") {
				return new Response("feed unavailable", { status: 503 });
			}
			const eps = served[url.pathname];
			if (!eps) return new Response("not found", { status: 404 });
			return new Response(feedXml(eps, url.origin), {
				headers: { "Content-Type": "application/rss+xml" },
			});
		},
	});
	origin = `http://127.0.0.1:${server.port}`;
});

afterAll(() => {
	server?.stop(true);
	rmSync(configHome, { recursive: true, force: true });
});

function makePodcast(overrides: Partial<Podcast> = {}): Podcast {
	return {
		id: "show-1",
		title: "Show 1",
		description: "",
		feedUrl: "https://example.test/feed.xml",
		lastUpdated: new Date(),
		isSubscribed: false,
		...overrides,
	};
}

test("openEpisodes fetches, caches, and never refetches on cache hit or in flight", async () => {
	const store = useDiscoverStore();
	const pod = makePodcast({ feedUrl: `${origin}/show1.xml` });
	served["/show1.xml"] = [{ title: "Ep 1", date: "2026-08-10T00:00:00Z" }];

	expect(store.episodesForPodcast(pod.id)).toHaveLength(0);

	await store.openEpisodes(pod);
	expect(requests).toEqual(["/show1.xml"]);
	expect(store.episodesForPodcast(pod.id)).toHaveLength(1);
	expect(store.episodesForPodcast(pod.id)[0].title).toBe("Ep 1");
	expect(store.isLoadingEpisodesFor(pod.id)).toBe(false);
	expect(store.previewError(pod.id)).toBeUndefined();

	// Cache hit: second open must not refetch.
	await store.openEpisodes(pod);
	expect(requests).toEqual(["/show1.xml"]);

	// In-flight guard: a concurrent open during loading must not refetch.
	// The server holds this show's response until the gate is released.
	const pod2 = makePodcast({ id: "show-2", feedUrl: `${origin}/slow.xml` });
	served["/slow.xml"] = [{ title: "Ep 2", date: "2026-08-09T00:00:00Z" }];
	gatePath = "/slow.xml";
	const pending = store.openEpisodes(pod2);
	// Loading is set synchronously before the fetch resolves.
	expect(store.isLoadingEpisodesFor(pod2.id)).toBe(true);
	await store.openEpisodes(pod2); // must early-return, not queue a second fetch
	// The request is held by the server gate; wait until it was actually
	// received so the assertion isn't racing the network.
	const deadline = Date.now() + 1000;
	while (requests.length < 2 && Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, 5));
	}
	expect(requests).toEqual(["/show1.xml", "/slow.xml"]);
	releaseGate?.();
	gatePath = null;
	await pending;
	expect(store.episodesForPodcast(pod2.id)[0].title).toBe("Ep 2");
	expect(store.isLoadingEpisodesFor(pod2.id)).toBe(false);
});

test("openEpisodes records an error for feedless shows and failed fetches", async () => {
	const store = useDiscoverStore();
	const feedless = makePodcast({ id: "show-3", feedUrl: undefined });

	await store.openEpisodes(feedless);
	expect(requests).not.toContain(feedless.id);
	expect(store.previewError(feedless.id)).toBe("No RSS feed listed for this show.");
	expect(store.episodesForPodcast(feedless.id)).toHaveLength(0);

	// Failed fetch (server 503) → error recorded, nothing cached.
	const failing = makePodcast({ id: "show-4", feedUrl: `${origin}/fail.xml` });
	await store.openEpisodes(failing);
	expect(store.previewError(failing.id)).toBe("Couldn't load episodes.");
	expect(store.episodesForPodcast(failing.id)).toHaveLength(0);
	expect(store.isLoadingEpisodesFor(failing.id)).toBe(false);
});

test("refreshEpisodes clears the cache and error, then refetches", async () => {
	const store = useDiscoverStore();
	const pod = makePodcast({ id: "show-5", feedUrl: `${origin}/show5.xml` });
	served["/show5.xml"] = [{ title: "Ep 1", date: "2026-08-10T00:00:00Z" }];

	await store.openEpisodes(pod);
	expect(store.episodesForPodcast(pod.id)).toHaveLength(1);
	const callsBefore = requests.length;

	await store.refreshEpisodes(pod);
	expect(requests.length).toBe(callsBefore + 1);
	expect(store.episodesForPodcast(pod.id)).toHaveLength(1);
	expect(store.previewError(pod.id)).toBeUndefined();
});
