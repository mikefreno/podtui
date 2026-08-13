/**
 * discover-store-preview.test.ts — the Discover episode-preview store API.
 *
 * `openEpisodes` fetches a show's RSS feed WITHOUT subscribing (drill-in from
 * a podcast result), caches it per podcast id for the session, records a
 * per-show error on failure, and never refetches while cached or in flight.
 * `refreshEpisodes` clears the cache/error and refetches. The feed store is
 * mocked so the network never runs; the cache-hit/in-flight/error contracts
 * are what this file defends.
 */

import { test, expect, mock } from "bun:test";
import type { Podcast } from "../src/types/podcast";
import type { Episode } from "../src/types/episode";

const fetchCalls: string[] = [];
const mockFeedStore = {
	fetchEpisodes: async (feedUrl: string, limit: number) => {
		fetchCalls.push(feedUrl);
		return {
			episodes: [makeEpisode("ep-1")] as Episode[] | null,
			coverUrl: undefined,
		};
	},
};
mock.module("../src/stores/feed", () => ({
	useFeedStore: () => mockFeedStore,
}));

const { useDiscoverStore } = await import("../src/stores/discover");

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

function makeEpisode(id: string): Episode {
	return {
		id,
		podcastId: "show-1",
		title: `Ep ${id}`,
		description: "",
		audioUrl: "https://example.test/ep.mp3",
		duration: 0,
		pubDate: new Date("2026-08-01T00:00:00Z"),
	};
}

test("openEpisodes fetches, caches, and never refetches on cache hit or in flight", async () => {
	const store = useDiscoverStore();
	const pod = makePodcast();

	expect(store.episodesForPodcast(pod.id)).toHaveLength(0);

	await store.openEpisodes(pod);
	expect(fetchCalls).toEqual([pod.feedUrl]);
	expect(store.episodesForPodcast(pod.id)).toHaveLength(1);
	expect(store.episodesForPodcast(pod.id)[0].id).toBe("ep-1");
	expect(store.isLoadingEpisodesFor(pod.id)).toBe(false);
	expect(store.previewError(pod.id)).toBeUndefined();

	// Cache hit: second open must not refetch.
	await store.openEpisodes(pod);
	expect(fetchCalls).toHaveLength(1);

	// In-flight guard: a concurrent open during loading must not refetch.
	const slow = mockFeedStore.fetchEpisodes;
	const gate = Promise.withResolvers<void>();
	mockFeedStore.fetchEpisodes = async (feedUrl: string, limit: number) => {
		fetchCalls.push(feedUrl);
		await gate.promise;
		return { episodes: [makeEpisode("ep-2")] as Episode[] | null, coverUrl: undefined };
	};
	const pod2 = makePodcast({ id: "show-2", feedUrl: "https://example.test/feed2.xml" });
	const pending = store.openEpisodes(pod2);
	// Loading is set synchronously before the fetch resolves.
	expect(store.isLoadingEpisodesFor(pod2.id)).toBe(true);
	await store.openEpisodes(pod2); // must early-return, not queue a second fetch
	gate.resolve();
	await pending;
	expect(fetchCalls).toEqual([pod.feedUrl, pod2.feedUrl]);
	expect(store.episodesForPodcast(pod2.id)[0].id).toBe("ep-2");
	expect(store.isLoadingEpisodesFor(pod2.id)).toBe(false);
	mockFeedStore.fetchEpisodes = slow;
});

test("openEpisodes records an error for feedless shows and failed fetches", async () => {
	const store = useDiscoverStore();
	const feedless = makePodcast({ id: "show-3", feedUrl: undefined });

	await store.openEpisodes(feedless);
	expect(fetchCalls).not.toContain(feedless.id);
	expect(store.previewError(feedless.id)).toBe("No RSS feed listed for this show.");
	expect(store.episodesForPodcast(feedless.id)).toHaveLength(0);

	// Failed fetch (null episodes) → error recorded, nothing cached.
	const original = mockFeedStore.fetchEpisodes;
	mockFeedStore.fetchEpisodes = async () => ({
		episodes: null,
		coverUrl: undefined,
	});
	const failing = makePodcast({ id: "show-4" });
	await store.openEpisodes(failing);
	expect(store.previewError(failing.id)).toBe("Couldn't load episodes.");
	expect(store.episodesForPodcast(failing.id)).toHaveLength(0);
	expect(store.isLoadingEpisodesFor(failing.id)).toBe(false);
	mockFeedStore.fetchEpisodes = original;
});

test("refreshEpisodes clears the cache and error, then refetches", async () => {
	const store = useDiscoverStore();
	const pod = makePodcast({ id: "show-5" });

	await store.openEpisodes(pod);
	expect(store.episodesForPodcast(pod.id)).toHaveLength(1);
	const callsBefore = fetchCalls.length;

	await store.refreshEpisodes(pod);
	expect(fetchCalls.length).toBe(callsBefore + 1);
	expect(store.episodesForPodcast(pod.id)).toHaveLength(1);
	expect(store.previewError(pod.id)).toBeUndefined();
});
