/**
 * Feed store for PodTUI
 * Manages feed data, sources, and filtering
 */

import { createSignal } from "solid-js";
import { FeedVisibility } from "../types/feed";
import type { Feed, FeedFilter, FeedSortField } from "../types/feed";
import type { Podcast } from "../types/podcast";
import type { Episode } from "../types/episode";
import type { PodcastSource } from "../types/source";
import { DEFAULT_SOURCES } from "../types/source";
import { getRSSItems, parseRSSItem, parseChannelCoverUrl } from "../api/rss-parser";
import { resolveItunesFeedUrl } from "../utils/itunes-feed-resolver";
import { savePodcastIndexCredentials } from "../utils/source-credentials";
import {
	episodeSignature,
	mergeEpisodesBounded,
} from "../utils/episode-merge";
import {
	DEFAULT_EPISODE_WINDOW_DAYS,
	episodeInWindow,
	loadFeedsFromFile,
	saveFeedsToFile,
	loadSourcesFromFile,
	saveSourcesToFile,
} from "../utils/feeds-persistence";
import { useActivityStore } from "./activity";
import { useDownloadStore } from "./download";
import { useAppStore } from "./app";
import { DownloadStatus } from "../types/episode";

/** Max episodes to load per page/chunk (count mode only — date mode steps
 *  by FETCH_MORE_WINDOW_DAYS instead). */
const MAX_EPISODES_REFRESH = 50;

/** Max episodes to fetch on initial subscribe */
const MAX_EPISODES_SUBSCRIBE = 20;

/** Fetch-more step in date mode: each press reveals the next two weeks of
 *  episodes past the oldest loaded one, instead of a fixed episode count. */
const FETCH_MORE_WINDOW_DAYS = 14;

/** Per-feed fetch timeout — a hung feed must not stall a refresh batch or
 *  the background refresh loop. */
const FETCH_TIMEOUT_MS = 20_000;

/** Bounds simultaneous RSS requests during a refresh batch — a hung feed
 *  burns at most one slot for FETCH_TIMEOUT_MS instead of pinning the whole
 *  batch. */
const FETCH_CONCURRENCY = 4;

/** Default minutes between automatic background feed refreshes. */
const DEFAULT_REFRESH_INTERVAL_MINUTES = 30;

/** Max episodes parsed per chunk before yielding to the event loop — bounds
 *  the synchronous regex work per frame so one huge feed (or a batch of
 *  feeds) can't stall the renderer. */
const PARSE_CHUNK_SIZE = 5;

/** Hard ceiling on the in-memory full-parse cache per feed (newest first).
 *  The cache exists so fetch-more can page deeper without a refetch; without
 *  a ceiling a 5,000-episode archive pins tens of MB of Episode objects in
 *  RAM for the whole session (the old cache held EVERY parsed episode of
 *  every feed, contributing hundreds of MB for archive-heavy
 *  subscriptions). 1000 covers any realistic show's entire history —
 *  beyond it, hasMoreEpisodes flips false and the visible list is bounded
 *  by the user's cache preference as usual. */
const MAX_CACHED_EPISODES_PER_FEED = 1000;

/** Yield to the event loop (task queue) so the renderer can paint between
 *  parse chunks. MessageChannel instead of setTimeout/setImmediate because
 *  bun:test fake timers trap those (feed-refresh/pagination tests run under
 *  vi.useFakeTimers and await refreshes, so a trapped yield would deadlock
 *  them); MessageChannel posts are real task-queue turns that fire in both
 *  environments. */
const yieldToUI = (): Promise<void> =>
	new Promise((resolve) => {
		const { port1, port2 } = new MessageChannel();
		port1.onmessage = () => {
			port1.close();
			port2.close();
			resolve();
		};
		port2.postMessage(null);
	});

/** Parse all episodes from feed XML in bounded chunks, yielding to the event
 *  loop between chunks. The whole-feed sync `parseRSSFeed` would otherwise
 *  block the UI thread for the combined parse time of every feed in a
 *  refresh batch. */
const parseEpisodesIncremental = async (
	xml: string,
	feedUrl: string,
): Promise<Episode[]> => {
	const items = getRSSItems(xml);
	// Yield after the item-extraction regex (which scans the full XML
	// synchronously) so the renderer paints before the first parse chunk.
	await yieldToUI();
	const episodes: Episode[] = new Array(items.length);
	for (let start = 0; start < items.length; start += PARSE_CHUNK_SIZE) {
		const end = Math.min(start + PARSE_CHUNK_SIZE, items.length);
		for (let i = start; i < end; i++) {
			episodes[i] = parseRSSItem(items[i], feedUrl, i);
		}
		if (end < items.length) await yieldToUI();
	}
	return episodes;
};

/** Cache of ALL parsed episodes per feed (feedId -> Episode[]). Holds the
 *  full parse — the bound (count or date) is applied when reading, not when
 *  writing, so changing the preference takes effect without a refetch.
 *  Fetch-more reads beyond the bound from this cache (volatile only — the
 *  cache itself is never extended by fetch-more). */
const fullEpisodeCache = new Map<string, Episode[]>();

/** Track how many episodes are currently loaded (visible) per feed. The
 *  loaded window grows via fetch-more but never exceeds what the cache
 *  holds — when it reaches the cache length, hasMoreEpisodes flips false. */
const episodeLoadCount = new Map<string, number>();

/** Read the episode cache bound from preferences: a closure that decides
 *  whether the episode at `index` (0 = newest, after sort) is kept. */
function episodeKeepFn(prefs: {
	episodeCacheMode: "date" | "count";
	episodeCacheCount: number;
	episodeCacheDays: number;
}): (ep: Episode, index: number) => boolean {
	const now = new Date();
	if (prefs.episodeCacheMode === "count") {
		const count = Math.max(1, prefs.episodeCacheCount);
		return (_ep: Episode, index: number) => index < count;
	}
	const days = Math.max(1, prefs.episodeCacheDays);
	return (ep: Episode) => episodeInWindow(ep, now, days);
}

/** Timestamp for window math — undated episodes sort/compare as NEWEST
 *  (Infinity) so they can never be excluded by a date cutoff. */
const epTs = (ep: Episode): number => {
	const t = ep.pubDate?.getTime();
	return t === undefined || Number.isNaN(t) ? Infinity : t;
};

/** Date-mode fetch-more cutoff: the oldest loaded episode's pubDate minus the
 *  2-week band. With nothing loaded (a show whose episodes all fall outside
 *  the cache window), the band anchors at the cache-window edge (now minus
 *  the configured days) — a dormant show can't drag in arbitrarily old
 *  episodes just because the button is pressed. */
const dateFetchMoreCutoff = (
	cached: Episode[],
	loaded: number,
	windowDays: number,
): number => {
	if (loaded > 0) {
		const t = epTs(cached[loaded - 1]);
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

/** Save feeds to file (async, fire-and-forget). */
function saveFeeds(feeds: Feed[]): void {
	const prefs = useAppStore().state().preferences;
	const days =
		prefs.episodeCacheMode === "date"
			? Math.max(1, prefs.episodeCacheDays)
			: undefined;
	saveFeedsToFile(feeds, days);
}

/** Save sources to file (async, fire-and-forget) */
function saveSources(sources: PodcastSource[]): void {
	saveSourcesToFile(sources);
}

/** Move plaintext apiKey/apiSecret (pre-keychain persistence) into the macOS
 *  keychain, marking the source hasCredentials and stripping the plaintext.
 *  When the keychain is unavailable the plaintext stays (marked as the
 *  plaintext storage backend) so the source keeps working.
 *  Returns the same array when nothing needed migrating. */
async function migratePlaintextCredentials(
	sources: PodcastSource[],
): Promise<PodcastSource[]> {
	let changed = false;
	const migrated: PodcastSource[] = [];
	for (const source of sources) {
		if (
			source.id === "podcastindex" &&
			source.apiKey &&
			source.apiSecret &&
			!source.hasCredentials
		) {
			const ok = await savePodcastIndexCredentials(
				source.apiKey,
				source.apiSecret,
			);
			if (ok) {
				migrated.push({
					...source,
					apiKey: undefined,
					apiSecret: undefined,
					hasCredentials: true,
					credentialStorage: "keychain",
				});
			} else {
				migrated.push({
					...source,
					hasCredentials: true,
					credentialStorage: "plaintext",
				});
			}
			changed = true;
			continue;
		}
		migrated.push(source);
	}
	return changed ? migrated : sources;
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

/** Run `fn` over every item with at most `limit` executions in flight — a
 *  classic worker pool. Workers pull indexes from a shared counter, so the
 *  first `limit` calls start immediately and each completion frees its slot
 *  for the next item; results are assembled in INPUT order regardless of
 *  completion order. A hung `fn` holds at most one slot. */
async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;
	const workers = Array.from(
		{ length: Math.min(limit, items.length) },
		async () => {
			let i: number;
			while ((i = nextIndex++) < items.length) {
				results[i] = await fn(items[i]);
			}
		},
	);
	await Promise.all(workers);
	return results;
}

function createFeedStore() {
	const [feeds, setFeeds] = createSignal<Feed[]>([]);
	const [sources, setSources] = createSignal<PodcastSource[]>([
		...DEFAULT_SOURCES,
	]);
	const [filter, setFilter] = createSignal<FeedFilter>({
		visibility: "all",
		sortBy: "updated" as FeedSortField,
		sortDirection: "desc",
	});
	const [selectedFeedId, setSelectedFeedId] = createSignal<string | null>(null);
	const [isLoadingMore, setIsLoadingMore] = createSignal(false);
	const [isLoadingFeeds, setIsLoadingFeeds] = createSignal(false);
	/** Feed-page fetch-more presses in COUNT mode: the global list is capped
	 *  at episodeCacheCount × (presses + 1) episodes, so one press reveals
	 *  exactly N more of the NEWEST episodes across all shows — it can never
	 *  dump deep history (see getAllEpisodesChronological). */
	const [countFetchMorePresses, setCountFetchMorePresses] = createSignal(0);

	// ── Debounced persistence ───────────────────────────────────────────────
	/** Trailing-edge debounce window for config.json writes. */
	const SAVE_DEBOUNCE_MS = 250;
	/** True when a save is scheduled but has not flushed yet. */
	let savePending = false;
	let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;

	/** Schedule a config.json write (trailing edge) — rapid state changes
	 *  (a refresh batch landing feed-by-feed, pin toggles, load-more pages)
	 *  collapse into one final write instead of one file rewrite per step. */
	const scheduleSaveFeeds = (): void => {
		savePending = true;
		if (pendingSaveTimer) clearTimeout(pendingSaveTimer);
		pendingSaveTimer = setTimeout(() => {
			pendingSaveTimer = null;
			flushPendingSave();
		}, SAVE_DEBOUNCE_MS);
	};

	/** Persist immediately when anything is dirty; exported for tests and
	 *  quit hooks. Cancels a pending debounced save — the state it would
	 *  have written is already reflected in feeds(), so writing now is
	 *  strictly more current. */
	const flushPendingSave = (): void => {
		if (pendingSaveTimer) {
			clearTimeout(pendingSaveTimer);
			pendingSaveTimer = null;
		}
		if (!savePending) return;
		savePending = false;
		saveFeeds(feeds());
	};

	const getFilteredFeeds = (): Feed[] => {
		let result = [...feeds()];
		const f = filter();

		if (f.visibility && f.visibility !== "all") {
			result = result.filter((feed) => feed.visibility === f.visibility);
		}

		if (f.sourceId) {
			result = result.filter((feed) => feed.sourceId === f.sourceId);
		}

		if (f.pinnedOnly) {
			result = result.filter((feed) => feed.isPinned);
		}

		if (f.searchQuery) {
			const query = f.searchQuery.toLowerCase();
			result = result.filter(
				(feed) =>
					feed.podcast.title.toLowerCase().includes(query) ||
					feed.customName?.toLowerCase().includes(query) ||
					feed.podcast.description?.toLowerCase().includes(query),
			);
		}

		const sortDir = f.sortDirection === "asc" ? 1 : -1;
		result.sort((a, b) => {
			switch (f.sortBy) {
				case "title":
					return (
						sortDir *
						(a.customName || a.podcast.title).localeCompare(
							b.customName || b.podcast.title,
						)
					);
				case "episodeCount":
					return sortDir * (a.episodes.length - b.episodes.length);
				case "latestEpisode":
					const aLatest = a.episodes[0]?.pubDate?.getTime() || 0;
					const bLatest = b.episodes[0]?.pubDate?.getTime() || 0;
					return sortDir * (aLatest - bLatest);
				case "updated":
				default:
					return sortDir * (a.lastUpdated.getTime() - b.lastUpdated.getTime());
			}
		});

		result.sort((a, b) => {
			if (a.isPinned && !b.isPinned) return -1;
			if (!a.isPinned && b.isPinned) return 1;
			return 0;
		});

		return result;
	};

	const getAllEpisodesChronological = (): Array<{
		episode: Episode;
		feed: Feed;
	}> => {
		const allEpisodes: Array<{ episode: Episode; feed: Feed }> = [];

		for (const feed of feeds()) {
			for (const episode of feed.episodes) {
				allEpisodes.push({ episode, feed });
			}
		}

		// Sort by publication date (newest first)
		allEpisodes.sort(
			(a, b) => b.episode.pubDate.getTime() - a.episode.pubDate.getTime(),
		);

		// COUNT mode: the Feed page is a GLOBAL top-K list — the newest
		// `episodeCacheCount × (fetch-more presses + 1)` episodes across ALL
		// shows, not N per show. A press reveals exactly N more recent
		// episodes; deep history never surfaces in one jump. The cap stays
		// even once every cache is exhausted (the button hides) — lifting it
		// rendered the full deep union and froze the UI.
		const prefs = useAppStore().state().preferences;
		if (prefs.episodeCacheMode === "count") {
			const limit =
				Math.max(1, prefs.episodeCacheCount ?? 25) *
				(countFetchMorePresses() + 1);
			return allEpisodes.slice(0, limit);
		}

		return allEpisodes;
	};

	const sortEpisodesReverseChronological = (episodes: Episode[]): Episode[] => {
		return [...episodes].sort(
			(a, b) => b.pubDate.getTime() - a.pubDate.getTime(),
		);
	};

	/** Fetch latest episodes from an RSS feed URL, caching ALL parsed
	 *  episodes in fullEpisodeCache. The visible episodes returned are
	 *  bounded by the user's cache preference (count or date); the full
	 *  cache survives so fetch-more can page beyond the bound without a
	 *  refetch (volatile only — the cache is never extended by fetch-more).
	 *  Returns NULL episodes on any failure — a failed fetch must not look
	 *  like an empty feed, or the store would wipe a subscribed show's
	 *  episodes. Also returns the channel-level artwork so callers can
	 *  backfill a feed's coverUrl (subscribe + refresh). */
	const fetchEpisodes = async (
		feedUrl: string,
		limit: number,
		feedId?: string,
	): Promise<{ episodes: Episode[] | null; coverUrl: string | undefined }> => {
		try {
			const response = await fetch(feedUrl, {
				headers: {
					"Accept-Encoding": "identity",
					Accept: "application/rss+xml, application/xml, text/xml, */*",
				},
				// Hung feeds must not stall a refresh batch (or the
				// background refresh loop) indefinitely.
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			});
			if (!response.ok) return { episodes: null, coverUrl: undefined };
			const xml = await response.text();
			// Yield after the network read so the renderer gets a turn
			// before the sync regex + parse work begins.
			await yieldToUI();
			const allEpisodes = sortEpisodesReverseChronological(
				await parseEpisodesIncremental(xml, feedUrl),
			);

			if (feedId) {
				// Cache the FULL parse — the bound is applied when reading,
				// not when writing, so a preference change takes effect
				// without a refetch. Capped at MAX_CACHED_EPISODES_PER_FEED
				// so an archive-heavy feed can't pin its entire history in
				// RAM for the session (the visible window below is bounded
				// by the user's preference regardless).
				fullEpisodeCache.set(
					feedId,
					allEpisodes.slice(0, MAX_CACHED_EPISODES_PER_FEED),
				);
			}

			// Bound the visible window by the user's cache preference.
			const prefs = useAppStore().state().preferences;
			const keep = episodeKeepFn(prefs);
			const bounded = allEpisodes.filter((ep, i) => keep(ep, i));
			const visible = bounded.slice(0, limit);

			if (feedId) {
				// Track how many episodes are visible — the bounded window,
				// not the full parse. hasMoreEpisodes compares this to the
				// full cache length to decide if fetch-more can page deeper.
				episodeLoadCount.set(feedId, visible.length);
			}

			return {
				episodes: visible,
				coverUrl: parseChannelCoverUrl(xml),
			};
		} catch {
			return { episodes: null, coverUrl: undefined };
		}
	};

	const hasFeedByUrl = (feedUrl: string): boolean => {
		return feeds().some((f) => f.podcast.feedUrl === feedUrl);
	};

	/** Add a new feed and auto-fetch latest 20 episodes */
	const addFeed = async (
		podcast: Podcast,
		sourceId: string,
		visibility: FeedVisibility = FeedVisibility.PUBLIC,
	): Promise<Feed | null> => {
		const activity = useActivityStore();
		// The "Subscribing" label covers the directory-resolve + subscribe
		// fetch stretch — the gaps no existing signal (isLoadingFeeds,
		// per-pane spinners) covers.
		return activity.track((async () => {
			// A directory stub (e.g. a show delisted from Apple Podcasts) has no
			// feed URL; resolve the real feed from its directory page before
			// subscribing. Refuse when it can't be resolved rather than adding a
			// broken feed.
			if (!podcast.feedUrl) {
				if (!podcast.directoryUrl) return null;
				const resolved = await resolveItunesFeedUrl(podcast.directoryUrl);
				if (!resolved) return null;
				podcast = { ...podcast, feedUrl: resolved, directoryUrl: undefined };
			}

			// Guard: don't add a feed we already have (matched by feedUrl)
			if (hasFeedByUrl(podcast.feedUrl)) {
				return feeds().find((f) => f.podcast.feedUrl === podcast.feedUrl) ?? null;
			}

			const feedId = crypto.randomUUID();
			const { episodes, coverUrl } = await fetchEpisodes(
				podcast.feedUrl,
				MAX_EPISODES_SUBSCRIBE,
				feedId,
			);
			if (!podcast.coverUrl && coverUrl) {
				podcast = { ...podcast, coverUrl };
			}
			const newFeed: Feed = {
				id: feedId,
				podcast,
				episodes: episodes ?? [],
				visibility,
				sourceId,
				lastUpdated: new Date(),
				isPinned: false,
			};
			setFeeds((prev) => {
				const updated = [...prev, newFeed];
				scheduleSaveFeeds();
				return updated;
			});
			// Global auto-download: newly subscribed shows join the next pass.
			runAutoDownload();
			return newFeed;
		})(), "Subscribing");
	};

	/** Download the N most recent episodes of every in-scope show, per the
	 *  global auto-download preferences (master toggle + scope + whitelist +
	 *  count). Skips episodes already downloaded, queued, or in flight;
	 *  retries failed ones. Idempotent — safe to run after any settings
	 *  change, feed refresh, or subscribe. */
	const runAutoDownload = (): void => {
		const app = useAppStore();
		const prefs = app.state().preferences;
		if (!prefs.autoDownload || prefs.autoDownloadScope === "none") return;
		const whitelist = prefs.autoDownloadWhitelist ?? [];
		const count = Math.max(1, prefs.autoDownloadCount ?? 2);
		const dlStore = useDownloadStore();
		for (const feed of feeds()) {
			if (
				prefs.autoDownloadScope === "whitelist" &&
				!whitelist.includes(feed.id)
			) {
				continue;
			}
			const sorted = [...feed.episodes].sort(
				(a, b) => b.pubDate.getTime() - a.pubDate.getTime(),
			);
			for (const ep of sorted.slice(0, count)) {
				const status = dlStore.getDownloadStatus(ep.id);
				if (
					status === DownloadStatus.NONE ||
					status === DownloadStatus.FAILED
				) {
					dlStore.startDownload(ep, feed.id);
				}
			}
		}
	};

	/** Apply a freshly fetched episode list to one feed, bumping `lastUpdated`
	 *  only when the content actually changed (see sameRefreshWindow). The
	 *  fetched window is MERGED into the existing episodes (fetched copy wins
	 *  on id collision) so a refresh never shrinks the in-memory list; the
	 *  union is pruned by the user's cache bound (count or date) so episodes
	 *  outside the bound fall out of the visible list on the next refresh.
	 *  Returns the ORIGINAL array reference when nothing changed so callers
	 *  skip persistence entirely — a refresh that fetched identical episodes
	 *  must not re-sort the "updated" view. */
	const applyRefreshedEpisodes = (
		prev: Feed[],
		feedId: string,
		episodes: Episode[],
	): Feed[] => {
		let changed = false;
		const prefs = useAppStore().state().preferences;
		const keep = episodeKeepFn(prefs);
		const updated = prev.map((f) => {
			if (f.id !== feedId) return f;
			const merged = mergeEpisodesBounded(f.episodes, episodes, keep);
			if (sameRefreshWindow(f.episodes, episodes)) return f;
			changed = true;
			return { ...f, episodes: merged, lastUpdated: new Date() };
		});
		return changed ? updated : prev;
	};

	/** Refresh a single feed - re-fetch latest 50 episodes */
	const refreshFeed = async (feedId: string) => {
		const activity = useActivityStore();
		return activity.track((async () => {
			const feed = getFeed(feedId);
			if (!feed) return;
			const { episodes, coverUrl } = await fetchEpisodes(
				feed.podcast.feedUrl,
				MAX_EPISODES_REFRESH,
				feedId,
			);
			// Fetch failed (null): keep the currently loaded episodes untouched.
			if (!episodes) return;
			setFeeds((prev) => {
				let updated = applyRefreshedEpisodes(prev, feedId, episodes);
				if (coverUrl) {
					updated = updated.map((f) =>
						f.id === feedId && !f.podcast.coverUrl && coverUrl
							? { ...f, podcast: { ...f.podcast, coverUrl } }
							: f,
					);
				}
				if (updated !== prev) scheduleSaveFeeds();
				return updated;
			});

			// Global auto-download: ensure the N most recent episodes of in-scope
			// shows are available offline after every refresh (idempotent).
			runAutoDownload();
		})(), "Refreshing");
	};

	/** Refresh all feeds — bounded concurrency (at most FETCH_CONCURRENCY
	 *  in-flight requests), and each feed's refreshed episodes are applied
	 *  AS ITS OWN FETCH LANDS (no Promise.all barrier). Per-feed apply is
	 *  safe because applyRefreshedEpisodes keeps unchanged feeds' object
	 *  identity and lastUpdated (union merge), so each feed's refreshed
	 *  episodes render as its own fetch resolves — the order flapping the
	 *  old atomic barrier existed to hide can no longer happen. */
	const refreshAllFeeds = async () => {
		setIsLoadingFeeds(true);
		try {
			await mapWithConcurrency(
				feeds(),
				FETCH_CONCURRENCY,
				async (feed) => {
					const { episodes, coverUrl } = await fetchEpisodes(
						feed.podcast.feedUrl,
						MAX_EPISODES_REFRESH,
						feed.id,
					);
					// A failed fetch (null) leaves that feed untouched.
					if (!episodes) return;
					setFeeds((prev) => {
						let updated = applyRefreshedEpisodes(prev, feed.id, episodes);
						if (coverUrl) {
							updated = updated.map((f) =>
								f.id === feed.id && !f.podcast.coverUrl && coverUrl
									? { ...f, podcast: { ...f.podcast, coverUrl } }
									: f,
							);
						}
						if (updated !== prev) scheduleSaveFeeds();
						return updated;
					});
				},
			);
			// Global auto-download: one idempotent pass after the batch.
			runAutoDownload();
			// A refresh batch always ends with a persisted write when
			// anything changed — never leave the debounce's trailing edge
			// pending across a process exit.
			flushPendingSave();
		} finally {
			setIsLoadingFeeds(false);
		}
	};

	// Resolves once the persisted feeds are loaded and visible to feeds() —
	// before the background refresh so boot-time consumers (player-session
	// restore) don't wait on the network.
	const { promise: feedsReady, resolve: resolveFeedsReady } =
		Promise.withResolvers<void>();
	(async () => {
		const loadedFeeds = await loadFeedsFromFile(
			useAppStore().state().preferences.episodeCacheMode === "date"
				? Math.max(1, useAppStore().state().preferences.episodeCacheDays)
				: undefined,
		);
		if (loadedFeeds.length > 0) setFeeds(loadedFeeds);
		resolveFeedsReady();
		const loadedSources = await loadSourcesFromFile<PodcastSource>();
		// The default "rss" placeholder source fabricated fake search results
		// and was removed from DEFAULT_SOURCES; drop it from persisted configs
		// too. User-added custom feeds keep their own ids and are untouched.
		const migratedSources =
			loadedSources?.filter((source) => source.id !== "rss") ?? [];
		// Default sources fill gaps in persisted configs (so new defaults like
		// the Podcast Index fallback reach existing installs), while a
		// persisted source with the same id always wins over its default —
		// user edits (keys, enabled, country) are never clobbered.
		const mergedSources = [
			...migratedSources,
			...DEFAULT_SOURCES.filter(
				(defaultSource) =>
					!migratedSources.some((s) => s.id === defaultSource.id),
			),
		];
		if (mergedSources.length > 0) {
			// One-time credential migration: sources persisted with plaintext
			// apiKey/apiSecret (pre-keychain builds) move into the macOS
			// keychain and are stripped from config.json.
			const secured = await migratePlaintextCredentials(mergedSources);
			setSources(secured);
			if (secured !== mergedSources) saveSources(secured);
		}
		await refreshAllFeeds();
	})();

	// ── Background refresh ──────────────────────────────────────────────────
	// New episodes only reach the app while it runs if feeds are re-fetched
	// on a schedule: startup and manual `r` alone leave a subscribed show's
	// latest episode invisible until the user restarts (or presses r). A
	// self-rescheduling timer re-reads the interval preference on every tick
	// so a settings change takes effect without a restart, and skips a tick
	// that would overlap an in-flight refresh (manual or background).
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;
	const scheduleNextRefresh = () => {
		if (refreshTimer) clearTimeout(refreshTimer);
		const minutes = Math.max(
			1,
			useAppStore().state().preferences.refreshIntervalMinutes ??
				DEFAULT_REFRESH_INTERVAL_MINUTES,
		);
		refreshTimer = setTimeout(() => {
			if (!isLoadingFeeds()) {
				refreshAllFeeds().catch(() => {});
			}
			scheduleNextRefresh();
		}, minutes * 60_000);
	};
	scheduleNextRefresh();

	const removeFeed = (feedId: string) => {
		fullEpisodeCache.delete(feedId);
		episodeLoadCount.delete(feedId);
		setFeeds((prev) => {
			const updated = prev.filter((f) => f.id !== feedId);
			// Unsubscribe intent must not sit in the debounce window if the
			// process exits — persist the removal immediately.
			scheduleSaveFeeds();
			flushPendingSave();
			return updated;
		});
	};

	/** Remove a feed by its RSS URL (for sources that match by URL, not ID) */
	const removeFeedByUrl = (feedUrl: string) => {
		const feed = feeds().find((f) => f.podcast.feedUrl === feedUrl);
		if (feed) {
			fullEpisodeCache.delete(feed.id);
			episodeLoadCount.delete(feed.id);
			setFeeds((prev) => {
				const updated = prev.filter((f) => f.podcast.feedUrl !== feedUrl);
				// Unsubscribe intent must not sit in the debounce window if
				// the process exits — persist the removal immediately.
				scheduleSaveFeeds();
				flushPendingSave();
				return updated;
			});
		}
	};

	const updateFeed = (feedId: string, updates: Partial<Feed>) => {
		setFeeds((prev) => {
			const updated = prev.map((f) =>
				f.id === feedId ? { ...f, ...updates, lastUpdated: new Date() } : f,
			);
			scheduleSaveFeeds();
			return updated;
		});
	};

	const togglePinned = (feedId: string) => {
		setFeeds((prev) => {
			const updated = prev.map((f) =>
				f.id === feedId ? { ...f, isPinned: !f.isPinned } : f,
			);
			scheduleSaveFeeds();
			return updated;
		});
	};

	const addSource = (source: Omit<PodcastSource, "id">) => {
		const newSource: PodcastSource = {
			...source,
			id: crypto.randomUUID(),
		};
		setSources((prev) => {
			const updated = [...prev, newSource];
			saveSources(updated);
			return updated;
		});
		return newSource;
	};

	const updateSource = (sourceId: string, updates: Partial<PodcastSource>) => {
		setSources((prev) => {
			const updated = prev.map((source) =>
				source.id === sourceId ? { ...source, ...updates } : source,
			);
			saveSources(updated);
			return updated;
		});
	};

	const removeSource = (sourceId: string) => {
		// Don't remove default sources
		if (DEFAULT_SOURCES.some((s) => s.id === sourceId)) return false;

		setSources((prev) => {
			const updated = prev.filter((s) => s.id !== sourceId);
			saveSources(updated);
			return updated;
		});
		return true;
	};

	const toggleSource = (sourceId: string) => {
		setSources((prev) => {
			const updated = prev.map((s) =>
				s.id === sourceId ? { ...s, enabled: !s.enabled } : s,
			);
			saveSources(updated);
			return updated;
		});
	};

	const getFeed = (feedId: string): Feed | undefined => {
		return feeds().find((f) => f.id === feedId);
	};

	/** Find an episode by ID across all loaded feeds (undefined when the
	 *  episode isn't in any loaded window, e.g. an unsubscribed show). */
	const findEpisode = (episodeId: string): Episode | undefined => {
		for (const feed of feeds()) {
			const ep = feed.episodes.find((e) => e.id === episodeId);
			if (ep) return ep;
		}
		return undefined;
	};

	const getSelectedFeed = (): Feed | undefined => {
		const id = selectedFeedId();
		return id ? getFeed(id) : undefined;
	};

	/** Check if a feed has more episodes available beyond what's currently
	 *  loaded. The full parse cache holds ALL episodes (including beyond the
	 *  cache bound), so fetch-more can page deeper — but in DATE mode only
	 *  when the next unloaded episode falls inside the next 2-week band: a
	 *  sparse/dormant show whose band is empty reports false, so fetch-more
	 *  never drags in arbitrarily old episodes just because the parse cache
	 *  holds them. When the loaded window reaches the cache length (or the
	 *  band is empty), this flips false. */
	const hasMoreEpisodes = (feedId: string): boolean => {
		const cached = fullEpisodeCache.get(feedId);
		if (!cached) return false;
		const loaded = episodeLoadCount.get(feedId) ?? 0;
		if (loaded >= cached.length) return false;
		const prefs = useAppStore().state().preferences;
		if (prefs.episodeCacheMode === "count") return true;
		const cutoff = dateFetchMoreCutoff(
			cached,
			loaded,
			prefs.episodeCacheDays ?? DEFAULT_EPISODE_WINDOW_DAYS,
		);
		return epTs(cached[loaded]) >= cutoff;
	};

	/** Load the next chunk of episodes for one feed from the full parse
	 *  cache — VOLATILE only: the episodes surfaced beyond the cache bound
	 *  are held in the feed's in-memory episode list (so the user can browse
	 *  them) but are NOT written back to fullEpisodeCache (the cache keeps
	 *  its original bounded shape; these episodes vanish on the next
	 *  refresh or restart). The cache is populated by fetchEpisodes/refresh;
	 *  a cold cache (post-restart) triggers a refetch here.
	 *  No global guard — callers own the `isLoadingMore` flag so batches
	 *  (loadMoreAllFeeds) can loop over multiple feeds in one go. */
	const loadMoreEpisodesForFeed = async (feedId: string) => {
		const feed = getFeed(feedId);
		if (!feed) return;

		let cached = fullEpisodeCache.get(feedId);

		// If no cache, re-fetch and parse the full feed (cold path after a
		// restart). The cache holds the FULL parse — no bound applied here.
		if (!cached) {
			try {
				const response = await fetch(feed.podcast.feedUrl, {
					headers: {
						"Accept-Encoding": "identity",
						Accept: "application/rss+xml, application/xml, text/xml, */*",
					},
					// A hung feed must not stall the load-more path forever —
					// mirror fetchEpisodes' per-feed timeout.
					signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				});
				if (!response.ok) return;
				const xml = await response.text();
				cached = await parseEpisodesIncremental(xml, feed.podcast.feedUrl);
			} catch {
				// Failed/hung refetch: leave the feed's loaded episodes
				// untouched rather than throwing out of loadMoreEpisodes.
				return;
			}
			// Cold-refetch parse output is unsorted; sort it newest-first.
			// Yield before the sync sort (the parse already yielded before
			// this point, but the sort of potentially hundreds of episodes
			// is its own sync block).
			await yieldToUI();
			cached = sortEpisodesReverseChronological(cached);
			// Same ceiling as fetchEpisodes: the cache (and the paging
			// window below) never exceeds MAX_CACHED_EPISODES_PER_FEED.
			cached = cached.slice(0, MAX_CACHED_EPISODES_PER_FEED);
			fullEpisodeCache.set(feedId, cached);
			// Set current load count to match what's already displayed
			episodeLoadCount.set(feedId, feed.episodes.length);
		}

		const currentCount = episodeLoadCount.get(feedId) ?? feed.episodes.length;
		const prefs = useAppStore().state().preferences;

		// Date mode: each press reveals the next FETCH_MORE_WINDOW_DAYS band
		// past the oldest loaded episode (or the cache-window edge when
		// nothing is loaded) — a daily show gains ~2 weeks of episodes, a
		// weekly show gains its next 2, never a fixed count. An empty band
		// is a genuine stop (hasMoreEpisodes hides the button) — no minimum,
		// so a sparse/dormant show can't grab arbitrarily old episodes.
		// Count mode keeps the fixed MAX_EPISODES_REFRESH chunk.
		let newCount: number;
		if (prefs.episodeCacheMode === "date") {
			const cutoff = dateFetchMoreCutoff(
				cached,
				currentCount,
				prefs.episodeCacheDays ?? DEFAULT_EPISODE_WINDOW_DAYS,
			);
			newCount = currentCount;
			while (
				newCount < cached.length &&
				epTs(cached[newCount]) >= cutoff
			) {
				newCount++;
			}
		} else {
			newCount = currentCount + MAX_EPISODES_REFRESH;
		}
		newCount = Math.min(newCount, cached.length);

		if (newCount <= currentCount) return; // nothing more to load

		// Advance the loaded window — volatile: the episodes beyond the cache
		// bound are held in feed.episodes (visible) but the cache itself is
		// NOT extended. episodeLoadCount tracks the volatile window size.
		episodeLoadCount.set(feedId, newCount);
		const episodes = cached.slice(0, newCount);

		// Yield a real macrotask turn before the sync state update so the
		// renderer paints the spinner and processes keyboard input before the
		// (potentially large, per-feed in loadMoreAllFeeds) setFeeds + sort
		// runs. Without this, the whole body executes in one microtask batch
		// and the UI freezes through every feed in the batch.
		await yieldToUI();

		setFeeds((prev) => {
			const updated = prev.map((f) =>
				f.id === feedId ? { ...f, episodes } : f,
			);
			scheduleSaveFeeds();
			return updated;
		});
	};

	/** Load the next chunk of episodes for a feed from the cache.
	 *  If no cache exists (e.g. app restart), re-fetches from the RSS feed. */
	const loadMoreEpisodes = async (feedId: string) => {
		if (isLoadingMore()) return;
		setIsLoadingMore(true);
		try {
			await loadMoreEpisodesForFeed(feedId);
		} finally {
			setIsLoadingMore(false);
		}
	};

	const hasMoreAcrossAll = (): boolean => {
		return feeds().some((f) => hasMoreEpisodes(f.id));
	};

	/** Power the Feed page's "[Fetch More]".
	 *  Date mode: advance each feed's window by its 2-week band (empty bands
	 *  — sparse/dormant shows — are skipped).
	 *  Count mode: the global list cap grows by one count (see
	 *  getAllEpisodesChronological) and every feed's window deepens by one
	 *  count so the growing cap has material; one press reveals exactly N
	 *  more RECENT episodes, never a far-back dump.
	 *  Both modes compute every feed's new window FIRST (yielding between
	 *  feeds so the renderer keeps painting) and apply ONE setFeeds — the
	 *  Feed list rebuilds once per press instead of once per feed (the
	 *  per-feed storms froze the UI). */
	const loadMoreAllFeeds = async () => {
		if (isLoadingMore()) return;
		setIsLoadingMore(true);
		try {
			const prefs = useAppStore().state().preferences;
			const count = Math.max(1, prefs.episodeCacheCount ?? 25);
			if (prefs.episodeCacheMode === "count") {
				setCountFetchMorePresses((p) => p + 1);
			}
			const windowDays =
				prefs.episodeCacheDays ?? DEFAULT_EPISODE_WINDOW_DAYS;

			const updates: Array<{ feedId: string; episodes: Episode[] }> = [];
			for (const feed of feeds()) {
				const cached = fullEpisodeCache.get(feed.id);
				if (!cached) continue;
				const currentCount =
					episodeLoadCount.get(feed.id) ?? feed.episodes.length;
				if (currentCount >= cached.length) continue;
				let newCount: number;
				if (prefs.episodeCacheMode === "count") {
					newCount = Math.min(currentCount + count, cached.length);
				} else {
					// Date mode: skip feeds whose next band is empty — the
					// button must not surface arbitrarily old episodes.
					const cutoff = dateFetchMoreCutoff(
						cached,
						currentCount,
						windowDays,
					);
					if (epTs(cached[currentCount]) < cutoff) continue;
					newCount = currentCount;
					while (
						newCount < cached.length &&
						epTs(cached[newCount]) >= cutoff
					) {
						newCount++;
					}
				}
				if (newCount <= currentCount) continue;
				episodeLoadCount.set(feed.id, newCount);
				updates.push({
					feedId: feed.id,
					episodes: cached.slice(0, newCount),
				});
				// Yield so the renderer paints between feed computations.
				await yieldToUI();
			}

			if (updates.length > 0) {
				const byId = new Map(
					updates.map((u) => [u.feedId, u.episodes]),
				);
				setFeeds((prev) =>
					prev.map((f) =>
						byId.has(f.id)
							? { ...f, episodes: byId.get(f.id)! }
							: f,
					),
				);
				scheduleSaveFeeds();
			}
		} finally {
			setIsLoadingMore(false);
		}
	};

	const runAutoDownloadNow = (): void => {
		runAutoDownload();
	};

	return {
		// State
		feeds,
		sources,
		filter,
		selectedFeedId,
		isLoadingMore,

		/** Resolves once persisted feeds are loaded from disk (before the
		 *  background refresh). */
		whenReady: () => feedsReady,

		// Computed
		getFilteredFeeds,
		getAllEpisodesChronological,
		getFeed,
		findEpisode,
		getSelectedFeed,
		hasMoreEpisodes,
		isLoadingFeeds,

		// Actions
		setFilter,
		setSelectedFeedId,
		/** Fetch + parse an RSS feed WITHOUT subscribing or touching any feed
		 *  record (Discover's episode preview). Pass no feedId to skip the
		 *  full-parse cache; the visible window is bounded by the user's
		 *  cache preference and `limit`. */
		fetchEpisodes,
		addFeed,
		hasFeedByUrl,
		removeFeed,
		removeFeedByUrl,
		updateFeed,
		togglePinned,
		refreshFeed,
		refreshAllFeeds,
		loadMoreEpisodes,
		loadMoreAllFeeds,
		hasMoreAcrossAll,
		flushPendingSave,
		addSource,
		removeSource,
		toggleSource,
		updateSource,
		runAutoDownload: runAutoDownloadNow,
	};
}

let feedStoreInstance: ReturnType<typeof createFeedStore> | null = null;

export function useFeedStore() {
	if (!feedStoreInstance) {
		feedStoreInstance = createFeedStore();
	}
	return feedStoreInstance;
}
