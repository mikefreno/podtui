/**
 * audio-queue unit tests — pure selection logic for next/prev navigation
 * and source-based auto-advance. Covers ordering, bounds, and the
 * deduplication that prevents "next" from replaying the current episode.
 */
import { test, expect } from "bun:test";
import {
	queueForSource,
	queueIndex,
	nextStep,
	prevStep,
} from "../src/utils/audio-queue";
import { AudioSource } from "../src/stores/audio-nav";
import type { Episode } from "../src/types/episode";
import type { Feed } from "../src/types/feed";
import { FeedVisibility } from "../src/types/feed";
import type { SearchResult } from "../src/types/source";

function ep(id: string, n: number): Episode {
	return {
		id,
		podcastId: "pod-" + id,
		title: `Episode ${n}`,
		description: "",
		audioUrl: `https://example.com/${id}.mp3`,
		duration: 600,
		pubDate: new Date(2026, 0, n),
	};
}

function feed(id: string, episodes: Episode[]): Feed {
	return {
		id,
		podcast: {
			id,
			title: "Feed " + id,
			description: "",
			feedUrl: `https://example.com/${id}.xml`,
			lastUpdated: new Date(),
			isSubscribed: true,
		},
		episodes,
		visibility: FeedVisibility.PUBLIC,
		sourceId: "rss",
		lastUpdated: new Date(),
		isPinned: false,
	};
}

function episodeResult(episode: Episode): SearchResult {
	return {
		sourceId: "itunes",
		kind: "episode",
		podcast: {
			id: episode.podcastId,
			title: "Show " + episode.podcastId,
			description: "",
			feedUrl: `https://example.com/${episode.podcastId}.xml`,
			lastUpdated: new Date(),
			isSubscribed: false,
		},
		episode,
	};
}

const e1 = ep("e1", 1);
const e2 = ep("e2", 2);
const e3 = ep("e3", 3);

test("FEED queue is the chronological global list, newest first", () => {
	const f1 = feed("f1", [e3, e2]);
	const f2 = feed("f2", [e1]);
	const queue = queueForSource(
		AudioSource.FEED,
		undefined,
		[f1, f2],
		[
			{ episode: e3, feed: f1 },
			{ episode: e2, feed: f1 },
			{ episode: e1, feed: f2 },
		],
		[],
	);
	expect(queue.map((e) => e.id)).toEqual(["e3", "e2", "e1"]);
	expect(queueIndex(queue, "e2")).toBe(1);
	expect(nextStep(queue, "e2")?.episode.id).toBe("e1");
	expect(prevStep(queue, "e2")?.episode.id).toBe("e3");
	expect(nextStep(queue, "e1")).toBeNull();
	expect(prevStep(queue, "e3")).toBeNull();
});

test("FEED queue dedupes repeated episode ids (same episode listed twice)", () => {
	// The same episode appears twice in the global list (e.g. a refresh
	// merge duplicated a feed's entries). Without dedupe, nextStep after
	// e2 would step onto e2 AGAIN — replaying the current episode.
	const f1 = feed("f1", [e3, e2, e2, e1]);
	const queue = queueForSource(
		AudioSource.FEED,
		undefined,
		[f1],
		[
			{ episode: e3, feed: f1 },
			{ episode: e2, feed: f1 },
			{ episode: e2, feed: f1 },
			{ episode: e1, feed: f1 },
		],
		[],
	);
	expect(queue.map((e) => e.id)).toEqual(["e3", "e2", "e1"]);
	// Distinct objects sharing an id dedupe too.
	const e2clone = { ...e2 };
	const queue2 = queueForSource(
		AudioSource.FEED,
		undefined,
		[f1],
		[
			{ episode: e3, feed: f1 },
			{ episode: e2, feed: f1 },
			{ episode: e2clone, feed: f1 },
		],
		[],
	);
	expect(queue2.map((e) => e.id)).toEqual(["e3", "e2"]);
	expect(nextStep(queue2, "e2")).toBeNull(); // no self-step
});

test("MY_SHOWS queue scopes to the podcast that started playback", () => {
	const fA = feed("podA", [e3, e2]);
	const fB = feed("podB", [e1]);
	const queue = queueForSource(
		AudioSource.MY_SHOWS,
		"podA",
		[fA, fB],
		[],
		[],
	);
	expect(queue.map((e) => e.id)).toEqual(["e3", "e2"]);
	// Unknown podcastId → empty queue (nothing to play next).
	expect(
		queueForSource(AudioSource.MY_SHOWS, "podX", [fA, fB], [], []),
	).toEqual([]);
});

test("SEARCH queue filters to episode-kind results in display order", () => {
	const queue = queueForSource(
		AudioSource.SEARCH,
		undefined,
		[],
		[],
		[episodeResult(e1), episodeResult(e2)],
	);
	expect(queue.map((e) => e.id)).toEqual(["e1", "e2"]);
	expect(queueIndex(queue, "e1")).toBe(0);
	expect(queueIndex(queue, "e3")).toBe(-1);
});
