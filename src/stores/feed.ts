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
import { mergeEpisodes } from "../utils/episode-merge";
import {
	loadFeedsFromFile,
	saveFeedsToFile,
	loadSourcesFromFile,
	saveSourcesToFile,
} from "../utils/feeds-persistence";
import { useActivityStore } from "./activity";
import { useDownloadStore } from "./download";
import { useAppStore } from "./app";
import { DownloadStatus } from "../types/episode";

/** Max episodes to load per page/chunk */
const MAX_EPISODES_REFRESH = 50;

/** Max episodes to fetch on initial subscribe */
const MAX_EPISODES_SUBSCRIBE = 20;

/** Per-feed bound on both the cached parse results and the merged in-memory
 *  window; 500 covers years of a weekly show's history while capping a
 *  20-subscription install at 10k episodes. */
export const MAX_EPISODES_IN_MEMORY = 500;

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
const PARSE_CHUNK_SIZE = 25;

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

/** Cache of all parsed episodes per feed (feedId -> Episode[]) */
const fullEpisodeCache = new Map<string, Episode[]>();

/** Track how many episodes are currently loaded per feed */
const episodeLoadCount = new Map<string, number>();

/** Save feeds to file (async, fire-and-forget) */
function saveFeeds(feeds: Feed[]): void {
	saveFeedsToFile(feeds);
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
 *  `lastUpdated` on every refresh. */
function sameRefreshWindow(existing: Episode[], fetched: Episode[]): boolean {
	if (fetched.length === 0) return true;
	const prefix = existing.slice(0, fetched.length);
	const ids = new Set(prefix.map((e) => e.id));
	return fetched.every((e) => ids.has(e.id));
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

/** Create feed store */
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

	/** Get filtered and sorted feeds */
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

	/** Get episodes in reverse chronological order across all feeds */
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

		return allEpisodes;
	};

	/** Sort episodes in reverse chronological order (newest first) */
	const sortEpisodesReverseChronological = (episodes: Episode[]): Episode[] => {
		return [...episodes].sort(
			(a, b) => b.pubDate.getTime() - a.pubDate.getTime(),
		);
	};

	/** Fetch latest episodes from an RSS feed URL, caching all parsed episodes.
	 *  Returns NULL when the feed could not be fetched (network error, non-OK
	/** Fetch latest episodes from an RSS feed URL, caching all parsed episodes.
	 *  Also returns the channel-level artwork so callers can backfill a feed's
	 *  coverUrl (subscribe + refresh). Null episodes on any failure — a
	 *  failed fetch must not look like an empty feed, or the store would wipe
	 *  a subscribed show's episodes. */
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
				// Hung feeds must not stall a refresh batch (or the background
				// refresh loop) indefinitely.
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			});
			if (!response.ok) return { episodes: null, coverUrl: undefined };
			const xml = await response.text();
			const channel = xml.match(/<channel[\s\S]*?<\/channel>/i)?.[0] ?? xml;
			const allEpisodes = sortEpisodesReverseChronological(
				await parseEpisodesIncremental(xml, feedUrl),
			);

			// Cache all parsed episodes for pagination
			if (feedId) {
				fullEpisodeCache.set(feedId, allEpisodes.slice(0, MAX_EPISODES_IN_MEMORY));
				episodeLoadCount.set(feedId, Math.min(limit, allEpisodes.length));
			}

			return {
				episodes: allEpisodes.slice(0, limit),
				coverUrl: parseChannelCoverUrl(channel),
			};
		} catch {
			return { episodes: null, coverUrl: undefined };
		}
	};

	/** Check if a feed with this URL already exists */
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
	 *  union is capped at MAX_EPISODES_IN_MEMORY. Returns the ORIGINAL array
	 *  reference when nothing changed so callers skip persistence entirely —
	 *  a refresh that fetched identical episodes must not re-sort the
	 *  "updated" view. */
	const applyRefreshedEpisodes = (
		prev: Feed[],
		feedId: string,
		episodes: Episode[],
	): Feed[] => {
		let changed = false;
		const updated = prev.map((f) => {
			if (f.id !== feedId) return f;
			const merged = mergeEpisodes(f.episodes, episodes, MAX_EPISODES_IN_MEMORY);
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
		const loadedFeeds = await loadFeedsFromFile();
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

	/** Remove a feed */
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

	/** Update a feed */
	const updateFeed = (feedId: string, updates: Partial<Feed>) => {
		setFeeds((prev) => {
			const updated = prev.map((f) =>
				f.id === feedId ? { ...f, ...updates, lastUpdated: new Date() } : f,
			);
			scheduleSaveFeeds();
			return updated;
		});
	};

	/** Toggle feed pinned status */
	const togglePinned = (feedId: string) => {
		setFeeds((prev) => {
			const updated = prev.map((f) =>
				f.id === feedId ? { ...f, isPinned: !f.isPinned } : f,
			);
			scheduleSaveFeeds();
			return updated;
		});
	};

	/** Add a source */
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

	/** Update a source */
	const updateSource = (sourceId: string, updates: Partial<PodcastSource>) => {
		setSources((prev) => {
			const updated = prev.map((source) =>
				source.id === sourceId ? { ...source, ...updates } : source,
			);
			saveSources(updated);
			return updated;
		});
	};

	/** Remove a source */
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

	/** Toggle source enabled status */
	const toggleSource = (sourceId: string) => {
		setSources((prev) => {
			const updated = prev.map((s) =>
				s.id === sourceId ? { ...s, enabled: !s.enabled } : s,
			);
			saveSources(updated);
			return updated;
		});
	};

	/** Get feed by ID */
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

	/** Get selected feed */
	const getSelectedFeed = (): Feed | undefined => {
		const id = selectedFeedId();
		return id ? getFeed(id) : undefined;
	};

	/** Check if a feed has more episodes available beyond what's currently loaded */
	const hasMoreEpisodes = (feedId: string): boolean => {
		const cached = fullEpisodeCache.get(feedId);
		if (!cached) return false;
		const loaded = episodeLoadCount.get(feedId) ?? 0;
		return loaded < cached.length;
	};

	/** Load the next chunk of episodes for one feed from the cache.
	 *  No global guard — callers own the `isLoadingMore` flag so batches
	 *  (loadMoreAllFeeds) can loop over multiple feeds in one go. */
	const loadMoreEpisodesForFeed = async (feedId: string) => {
		const feed = getFeed(feedId);
		if (!feed) return;

		let cached = fullEpisodeCache.get(feedId);

		// If no cache, re-fetch and parse the full feed
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
			// Cold-refetch parse output is unsorted; sort and cap it so the
			// cache and the pagination window stay newest-first and bounded.
			cached = sortEpisodesReverseChronological(cached);
			cached = cached.slice(0, MAX_EPISODES_IN_MEMORY);
			fullEpisodeCache.set(feedId, cached);
			// Set current load count to match what's already displayed
			episodeLoadCount.set(feedId, feed.episodes.length);
		}

		const currentCount = episodeLoadCount.get(feedId) ?? feed.episodes.length;
		const newCount = Math.min(
			currentCount + MAX_EPISODES_REFRESH,
			cached.length,
		);

		if (newCount <= currentCount) return; // nothing more to load

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

	/** True if any feed still has cached episodes beyond its loaded window. */
	const hasMoreAcrossAll = (): boolean => {
		return feeds().some((f) => hasMoreEpisodes(f.id));
	};

	/** Advance the loaded window by MAX_EPISODES_REFRESH for every feed that
	 *  still has cached episodes — powers the Feed page's "[Fetch More]". */
	const loadMoreAllFeeds = async () => {
		if (isLoadingMore()) return;
		setIsLoadingMore(true);
		try {
			const pending = feeds().filter((f) => hasMoreEpisodes(f.id));
			for (const feed of pending) {
				await loadMoreEpisodesForFeed(feed.id);
			}
		} finally {
			setIsLoadingMore(false);
		}
	};

	/** Run the global auto-download pass (see runAutoDownload above). */
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

/** Singleton feed store */
let feedStoreInstance: ReturnType<typeof createFeedStore> | null = null;

export function useFeedStore() {
	if (!feedStoreInstance) {
		feedStoreInstance = createFeedStore();
	}
	return feedStoreInstance;
}
