/**
 * audio-queue — ordered episode queue for "what plays next" navigation.
 *
 * Pure selection logic for source-based auto-advance (and manual next/prev):
 * given the navigation source that STARTED the current episode, which
 * episodes come after it?
 *
 *   FEED      — the global chronological Feed list (newest first), so "next"
 *               walks toward older episodes — further down the list.
 *   MY_SHOWS  — the current show's episode list (newest first), scoped to the
 *               podcast that started playback.
 *   SEARCH    — the current search results, in display order (episode-kind
 *               results only — a show result has nothing to play).
 *
 * Kept dependency-light (pure functions over plain data) so the ordering and
 * bounds contract is unit-testable without stores or audio.
 */

import type { Episode } from "../types/episode";
import type { Feed } from "../types/feed";
import type { SearchResult } from "../types/source";
import { AudioSource } from "../stores/audio-nav";

/** The ordered playable queue for a navigation source. Empty when the
 *  source's context is missing (no podcastId, no search results, no feeds). */
export function queueForSource(
	source: AudioSource,
	podcastId: string | undefined,
	feeds: Feed[],
	allEpisodes: Array<{ episode: Episode; feed: Feed }>,
	searchResults: SearchResult[],
): Episode[] {
	if (source === AudioSource.FEED) {
		// Dedupe by episode id: the same episode can appear twice after a
		// refresh merge or when two feeds list it — a duplicate would make
		// next/auto-advance step onto the CURRENT episode and replay it.
		const seen = new Set<string>();
		const unique: Episode[] = [];
		for (const e of allEpisodes) {
			if (seen.has(e.episode.id)) continue;
			seen.add(e.episode.id);
			unique.push(e.episode);
		}
		return unique;
	}
	if (source === AudioSource.MY_SHOWS) {
		const feed = feeds.find((f) => f.podcast.id === podcastId);
		return feed ? feed.episodes : [];
	}
	if (source === AudioSource.SEARCH) {
		return searchResults
			.filter((r) => r.kind === "episode")
			.map((r) => r.episode);
	}
	return [];
}

/** Index of an episode in the queue, or -1 when the episode isn't in it. */
export function queueIndex(queue: Episode[], episodeId: string): number {
	return queue.findIndex((e) => e.id === episodeId);
}

export interface QueueStep {
	episode: Episode;
	index: number;
}

/** The episode after `episodeId` in the queue, with its index. Null when
 *  the episode isn't in the queue or is already the last one. */
export function nextStep(
	queue: Episode[],
	episodeId: string,
): QueueStep | null {
	const idx = queueIndex(queue, episodeId);
	if (idx < 0 || idx + 1 >= queue.length) return null;
	return { episode: queue[idx + 1], index: idx + 1 };
}

/** The episode before `episodeId` in the queue, with its index. Null when
 *  the episode isn't in the queue or is already the first one. */
export function prevStep(
	queue: Episode[],
	episodeId: string,
): QueueStep | null {
	const idx = queueIndex(queue, episodeId);
	if (idx <= 0) return null;
	return { episode: queue[idx - 1], index: idx - 1 };
}
