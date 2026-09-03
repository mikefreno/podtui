/**
 * Episode cache-window math — shared by the feed store's refresh, retention,
 * and fetch-more paging paths. Pure module: no Solid, no store imports.
 */

import type { Episode } from "../types/episode";
import { episodeSignature } from "./episode-merge";
import { episodeInWindow } from "./feeds-persistence";

/** Floor on the visible episode window for a subscribed show: at least this
 *  many most-recent episodes always load, regardless of a stricter count or
 *  date cache bound. */
const MIN_EPISODES_PER_SHOW = 5;

/** Fetch-more step in date mode: each press reveals the next two weeks of
 *  episodes past the oldest loaded one, instead of a fixed episode count. */
const FETCH_MORE_WINDOW_DAYS = 14;

/** Timestamp for window math — undated episodes sort/compare as NEWEST
 *  (Infinity) so they can never be excluded by a date cutoff. */
export const episodeTs = (ep: Episode): number => {
	const t = ep.pubDate?.getTime();
	return t === undefined || Number.isNaN(t) ? Infinity : t;
};

/** Read the episode cache bound from preferences: a closure that decides
 *  whether the episode at `index` (0 = newest, after sort) is kept. The five
 *  most-recent episodes of a subscribed show always stay (MIN_EPISODES_PER_SHOW),
 *  overriding a stricter count or date bound so every show surfaces at least
 *  five episodes. */
export function episodeKeepFn(
	prefs: {
		episodeCacheMode: "date" | "count";
		episodeCacheCount: number;
		episodeCacheDays: number;
	},
	now?: Date,
): (ep: Episode, index: number) => boolean {
	const at = now ?? new Date();
	if (prefs.episodeCacheMode === "count") {
		const count = Math.max(1, prefs.episodeCacheCount);
		return (_ep: Episode, index: number) =>
			index < Math.max(count, MIN_EPISODES_PER_SHOW);
	}
	const days = Math.max(1, prefs.episodeCacheDays);
	return (ep: Episode, index: number) =>
		index < MIN_EPISODES_PER_SHOW || episodeInWindow(ep, at, days);
}

/** Date-mode fetch-more cutoff: the oldest loaded episode's pubDate minus the
 *  2-week band. With nothing loaded (a show whose episodes all fall outside
 *  the cache window), the band anchors at the cache-window edge (now minus
 *  the configured days) — a dormant show can't drag in arbitrarily old
 *  episodes just because the button is pressed. */
export const dateFetchMoreCutoff = (
	cached: Episode[],
	loaded: number,
	windowDays: number,
): number => {
	if (loaded > 0) {
		const t = episodeTs(cached[loaded - 1]);
		if (Number.isFinite(t)) {
			return t - FETCH_MORE_WINDOW_DAYS * 24 * 3600 * 1000;
		}
	}
	// Nothing loaded: the band extends FETCH_MORE_WINDOW_DAYS before the
	// cache-window edge (e.g. 60d → reveals the 60–74d slice).
	return (
		Date.now() -
		Math.max(1, windowDays) * 24 * 3600 * 1000 -
		FETCH_MORE_WINDOW_DAYS * 24 * 3600 * 1000
	);
};

/** Episodes the date band adds past the loaded window: count forward while
 *  each next cached episode still falls on/after the cutoff. The single
 *  implementation behind both fetch-more paths (one feed / all feeds) — an
 *  empty band adds nothing, which doubles as the "has more" guard. */
export function dateBandCount(
	cached: Episode[],
	loaded: number,
	cutoff: number,
): number {
	let count = loaded;
	while (count < cached.length && episodeTs(cached[count]) >= cutoff) {
		count++;
	}
	return count;
}

/** True when the freshly fetched window matches the corresponding PREFIX of
 *  the existing episode list (id-set equality, order-insensitive). With
 *  union semantics the merged list legitimately contains episodes BEYOND the
 *  fetched window, so unchanged-detection must compare the fetched window
 *  against the existing list's prefix — comparing full lists would bump
 *  `lastUpdated` on every refresh. When ids drifted between refreshes (the
 *  one-time positional-id migration, or a feed that rotates enclosure URLs)
 *  the id sets differ for the SAME content, so a content-signature
 *  comparison decides: an unchanged feed stays unchanged. */
export function sameRefreshWindow(
	existing: Episode[],
	fetched: Episode[],
): boolean {
	if (fetched.length === 0) return true;
	const prefix = existing.slice(0, fetched.length);
	const ids = new Set(prefix.map((e) => e.id));
	if (fetched.every((e) => ids.has(e.id))) return true;
	if (prefix.length !== fetched.length) return false;
	const signatures = new Set(prefix.map(episodeSignature));
	return fetched.every((e) => signatures.has(episodeSignature(e)));
}
