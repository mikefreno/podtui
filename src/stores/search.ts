/**
 * Search store for PodTUI
 * Manages search state, history, and results
 */

import { createSignal } from "solid-js";
import { searchPodcasts, searchEpisodes, searchByFeedUrl } from "../utils/search";
import {
	loadSearchHistoryFromFile,
	saveSearchHistoryToFile,
} from "../utils/app-persistence";
import { useFeedStore } from "./feed";
import type { SearchResult, SearchScope } from "../types/source";

const STORAGE_SCOPE_KEY = "podtui_search_scope";
const MAX_HISTORY = 10;

export interface SearchState {
	query: string;
	isSearching: boolean;
	results: SearchResult[];
	error: string | null;
}

const CACHE_TTL = 1000 * 60 * 5;

/** Normalize raw history: drop blanks, dedupe case-insensitively (newest
 *  wins), cap at MAX_HISTORY. */
function sanitizeHistory(items: string[]): string[] {
	const seen = new Set<string>();
	const cleaned: string[] = [];
	for (const item of items) {
		const trimmed = item.trim();
		const key = trimmed.toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		cleaned.push(trimmed);
	}
	return cleaned.slice(0, MAX_HISTORY);
}

/** Load persisted search scope ("podcast" | "episode"), defaulting to shows. */
function loadScope(): SearchScope {
	if (typeof localStorage === "undefined") return "podcast";
	try {
		const stored = localStorage.getItem(STORAGE_SCOPE_KEY);
		return stored === "episode" ? "episode" : "podcast";
	} catch {
		return "podcast";
	}
}

/** Save search scope to localStorage */
function saveScope(scope: SearchScope): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(STORAGE_SCOPE_KEY, scope);
	} catch {
		// Ignore errors
	}
}

/** Create search store */
export function createSearchStore() {
	const feedStore = useFeedStore();
	const [query, setQuery] = createSignal("");
	const [isSearching, setIsSearching] = createSignal(false);
	const [results, setResults] = createSignal<SearchResult[]>([]);
	const [error, setError] = createSignal<string | null>(null);
	const [history, setHistory] = createSignal<string[]>([]);
	const [selectedSources, setSelectedSources] = createSignal<string[]>([]);
	const [scope, setScopeState] = createSignal<SearchScope>(loadScope());

	/** Load search history from file (fire-and-forget; recents appear as
	 *  soon as the file is read). */
	async function init(): Promise<void> {
		const loaded = await loadSearchHistoryFromFile();
		if (loaded.length > 0) setHistory(sanitizeHistory(loaded));
	}

	init();

	/** Set the search scope (shows vs episodes) and persist it. */
	const setScope = (next: SearchScope) => {
		setScopeState(next);
		saveScope(next);
	};

	const applySubscribedStatus = (items: SearchResult[]): SearchResult[] => {
		const feeds = feedStore.feeds();
		const subscribedUrls = new Set(feeds.map((feed) => feed.podcast.feedUrl));
		const subscribedIds = new Set(feeds.map((feed) => feed.podcast.id));

		return items.map((item) => ({
			...item,
			podcast: {
				...item.podcast,
				isSubscribed:
					item.podcast.isSubscribed ||
					subscribedUrls.has(item.podcast.feedUrl) ||
					subscribedIds.has(item.podcast.id),
			},
		}));
	};

	/** Perform search (multi-source implementation) */
	const search = async (searchQuery: string): Promise<void> => {
		const q = searchQuery.trim();
		if (!q) {
			setResults([]);
			return;
		}

		setQuery(q);
		setIsSearching(true);
		setError(null);

		addToHistory(q);

		try {
			// A query that is a direct RSS feed URL (e.g. a private feed that
			// isn't in any public directory) resolves to that feed directly,
			// independent of enabled search sources.
			const urlResults = await searchByFeedUrl(q);
			if (urlResults.length > 0) {
				setResults(applySubscribedStatus(urlResults));
				return;
			}

			const sources = feedStore.sources();
			const enabledSourceIds = sources
				.filter((s) => s.enabled)
				.map((s) => s.id);
			const sourceIds =
				selectedSources().length > 0 ? selectedSources() : enabledSourceIds;

			// Empty query guard already returned above; if there are no enabled
			// sources, tell the user instead of returning an empty list that looks
			// like a network outage.
			if (enabledSourceIds.length === 0) {
				setError(
					"No search sources are enabled. Enable one in Settings → Sources.",
				);
				setResults([]);
				return;
			}

			const searchResults =
				scope() === "episode"
					? await searchEpisodes(q, sourceIds, sources, {
							cacheTtl: CACHE_TTL,
						})
					: await searchPodcasts(q, sourceIds, sources, {
							cacheTtl: CACHE_TTL,
						});

			setResults(applySubscribedStatus(searchResults));
		} catch (e) {
			setError(
				e instanceof Error && e.message
					? e.message
					: "Search failed. Please try again.",
			);
			setResults([]);
		} finally {
			setIsSearching(false);
		}
	};

	/** Add query to history */
	const addToHistory = (q: string) => {
		setHistory((prev) => {
			const updated = sanitizeHistory([q, ...prev]);
			saveSearchHistoryToFile(updated);
			return updated;
		});
	};

	/** Clear search history */
	const clearHistory = () => {
		setHistory([]);
		saveSearchHistoryToFile([]);
	};

	/** Remove single history item */
	const removeFromHistory = (q: string) => {
		setHistory((prev) => {
			const updated = prev.filter((h) => h !== q);
			saveSearchHistoryToFile(updated);
			return updated;
		});
	};

	/** Clear results */
	const clearResults = () => {
		setResults([]);
		setQuery("");
		setError(null);
	};

	/** Mark a podcast as subscribed in results */
	const markSubscribed = (podcastId: string, feedUrl?: string) => {
		setResults((prev) =>
			prev.map((result) => {
				const matchesId = result.podcast.id === podcastId;
				const matchesUrl = feedUrl ? result.podcast.feedUrl === feedUrl : false;
				if (matchesId || matchesUrl) {
					return {
						...result,
						podcast: {
							...result.podcast,
							isSubscribed: true,
						},
					};
				}
				return result;
			}),
		);
	};

	/** Mark a podcast as unsubscribed in results (after an in-place
	 *  unsubscribe from the results list). */
	const markUnsubscribed = (podcastId: string, feedUrl?: string) => {
		setResults((prev) =>
			prev.map((result) => {
				const matchesId = result.podcast.id === podcastId;
				const matchesUrl = feedUrl ? result.podcast.feedUrl === feedUrl : false;
				if (matchesId || matchesUrl) {
					return {
						...result,
						podcast: {
							...result.podcast,
							isSubscribed: false,
						},
					};
				}
				return result;
			}),
		);
	};

	return {
		// State
		query,
		isSearching,
		results,
		error,
		history,
		selectedSources,
		scope,

		// Actions
		search,
		setQuery,
		clearResults,
		clearHistory,
		removeFromHistory,
		setSelectedSources,
		setScope,
		markSubscribed,
		markUnsubscribed,
	};
}

/** Singleton search store */
let searchStoreInstance: ReturnType<typeof createSearchStore> | null = null;

export function useSearchStore() {
	if (!searchStoreInstance) {
		searchStoreInstance = createSearchStore();
	}
	return searchStoreInstance;
}
