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
import { parseRSSFeed } from "../api/rss-parser";
import {
	loadFeedsFromFile,
	saveFeedsToFile,
	loadSourcesFromFile,
	saveSourcesToFile,
} from "../utils/feeds-persistence";
import { useDownloadStore } from "./download";
import { useAppStore } from "./app";
import { DownloadStatus } from "../types/episode";

/** Max episodes to load per page/chunk */
const MAX_EPISODES_REFRESH = 50;

/** Max episodes to fetch on initial subscribe */
const MAX_EPISODES_SUBSCRIBE = 20;

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

	/** Fetch latest episodes from an RSS feed URL, caching all parsed episodes */
	const fetchEpisodes = async (
		feedUrl: string,
		limit: number,
		feedId?: string,
	): Promise<Episode[]> => {
		try {
			const response = await fetch(feedUrl, {
				headers: {
					"Accept-Encoding": "identity",
					Accept: "application/rss+xml, application/xml, text/xml, */*",
				},
			});
			if (!response.ok) return [];
			const xml = await response.text();
			const parsed = parseRSSFeed(xml, feedUrl);
			const allEpisodes = sortEpisodesReverseChronological(parsed.episodes);

			// Cache all parsed episodes for pagination
			if (feedId) {
				fullEpisodeCache.set(feedId, allEpisodes);
				episodeLoadCount.set(feedId, Math.min(limit, allEpisodes.length));
			}

			return allEpisodes.slice(0, limit);
		} catch {
			return [];
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
		// Guard: don't add a feed we already have (matched by feedUrl)
		if (hasFeedByUrl(podcast.feedUrl)) {
			return feeds().find((f) => f.podcast.feedUrl === podcast.feedUrl) ?? null;
		}

		const feedId = crypto.randomUUID();
		const episodes = await fetchEpisodes(
			podcast.feedUrl,
			MAX_EPISODES_SUBSCRIBE,
			feedId,
		);
		const newFeed: Feed = {
			id: feedId,
			podcast,
			episodes,
			visibility,
			sourceId,
			lastUpdated: new Date(),
			isPinned: false,
		};
		setFeeds((prev) => {
			const updated = [...prev, newFeed];
			saveFeeds(updated);
			return updated;
		});
		// Global auto-download: newly subscribed shows join the next pass.
		runAutoDownload();
		return newFeed;
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

	/** Refresh a single feed - re-fetch latest 50 episodes */
	const refreshFeed = async (feedId: string) => {
		const feed = getFeed(feedId);
		if (!feed) return;
		const episodes = await fetchEpisodes(
			feed.podcast.feedUrl,
			MAX_EPISODES_REFRESH,
			feedId,
		);
		setFeeds((prev) => {
			const updated = prev.map((f) =>
				f.id === feedId ? { ...f, episodes, lastUpdated: new Date() } : f,
			);
			saveFeeds(updated);
			return updated;
		});

		// Global auto-download: ensure the N most recent episodes of in-scope
		// shows are available offline after every refresh (idempotent).
		runAutoDownload();
	};

	/** Refresh all feeds */
	const refreshAllFeeds = async () => {
		setIsLoadingFeeds(true);
		try {
			const currentFeeds = feeds();
			for (const feed of currentFeeds) {
				await refreshFeed(feed.id);
			}
		} finally {
			setIsLoadingFeeds(false);
		}
	};

	(async () => {
		const loadedFeeds = await loadFeedsFromFile();
		if (loadedFeeds.length > 0) setFeeds(loadedFeeds);
		const loadedSources = await loadSourcesFromFile<PodcastSource>();
		if (loadedSources && loadedSources.length > 0) setSources(loadedSources);
		await refreshAllFeeds();
	})();

	/** Remove a feed */
	const removeFeed = (feedId: string) => {
		fullEpisodeCache.delete(feedId);
		episodeLoadCount.delete(feedId);
		setFeeds((prev) => {
			const updated = prev.filter((f) => f.id !== feedId);
			saveFeeds(updated);
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
				saveFeeds(updated);
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
			saveFeeds(updated);
			return updated;
		});
	};

	/** Toggle feed pinned status */
	const togglePinned = (feedId: string) => {
		setFeeds((prev) => {
			const updated = prev.map((f) =>
				f.id === feedId ? { ...f, isPinned: !f.isPinned } : f,
			);
			saveFeeds(updated);
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
		if (sourceId === "itunes" || sourceId === "rss") return false;

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
			const response = await fetch(feed.podcast.feedUrl, {
				headers: {
					"Accept-Encoding": "identity",
					Accept: "application/rss+xml, application/xml, text/xml, */*",
				},
			});
			if (!response.ok) return;
			const xml = await response.text();
			const parsed = parseRSSFeed(xml, feed.podcast.feedUrl);
			cached = parsed.episodes;
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

		setFeeds((prev) => {
			const updated = prev.map((f) =>
				f.id === feedId ? { ...f, episodes } : f,
			);
			saveFeeds(updated);
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

		// Computed
		getFilteredFeeds,
		getAllEpisodesChronological,
		getFeed,
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
