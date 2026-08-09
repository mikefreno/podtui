import { searchSourceByType } from "./source-searcher";
import { parseRSSFeed } from "../api/rss-parser";
import { SourceType } from "../types/source";
import type { PodcastSource, SearchResult } from "../types/source";

type SearchCacheEntry = {
	timestamp: number;
	results: SearchResult[];
};

type SearchOptions = {
	cacheTtl?: number;
};

const searchCache = new Map<string, SearchCacheEntry>();
const rateLimitState = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_CALLS = 20;

const throttleSource = async (sourceId: string) => {
	const now = Date.now();
	const windowStart = now - RATE_LIMIT_WINDOW_MS;
	const timestamps =
		rateLimitState.get(sourceId)?.filter((ts) => ts > windowStart) ?? [];

	if (timestamps.length >= RATE_LIMIT_MAX_CALLS) {
		const waitMs = timestamps[0] + RATE_LIMIT_WINDOW_MS - now;
		if (waitMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, waitMs));
		}
	}

	const updated =
		rateLimitState.get(sourceId)?.filter((ts) => ts > windowStart) ?? [];
	updated.push(Date.now());
	rateLimitState.set(sourceId, updated);
};

const buildCacheKey = (query: string, sourceIds: string[]) => {
	const keySources = [...sourceIds].sort().join(",");
	return `${query.toLowerCase()}::${keySources}`;
};

const isCacheValid = (entry: SearchCacheEntry, ttl: number) =>
	Date.now() - entry.timestamp < ttl;

const dedupeResults = (results: SearchResult[]): SearchResult[] => {
	const map = new Map<string, SearchResult>();
	for (const result of results) {
		const key =
			result.podcast.feedUrl || result.podcast.id || result.podcast.title;
		const existing = map.get(key);
		if (!existing || (result.score ?? 0) > (existing.score ?? 0)) {
			map.set(key, result);
		}
	}
	return Array.from(map.values());
};

const FEED_URL_RE = /^https?:\/\/.+/i;

/**
 * If the query is a direct RSS feed URL (useful for private feeds that aren't
 * in public directories), fetch and parse it into a single search result.
 * Returns an empty array when the query is not a URL so normal search proceeds.
 */
export const searchByFeedUrl = async (
  query: string,
): Promise<SearchResult[]> => {
  const trimmed = query.trim();
  if (!FEED_URL_RE.test(trimmed)) return [];

  try {
    const response = await fetch(trimmed, {
      headers: {
        "Accept-Encoding": "identity",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!response.ok) return [];

    const xml = await response.text();
    const podcast = parseRSSFeed(xml, trimmed);

    return [
      {
        sourceId: "direct-rss",
        sourceName: "RSS Feed",
        sourceType: SourceType.RSS,
        // parseRSSFeed marks feeds subscribed; a search result should start
        // unsubscribed so the store can flag it correctly if already added.
        podcast: { ...podcast, isSubscribed: false },
        score: 1,
      },
    ];
  } catch {
    return [];
  }
};

export const searchPodcasts = async (
	query: string,
	sourceIds: string[],
	sources: PodcastSource[],
	options: SearchOptions = {},
): Promise<SearchResult[]> => {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const activeSources = sources.filter(
		(source) => sourceIds.includes(source.id) && source.enabled,
	);

	if (activeSources.length === 0) {
		// No enabled sources — surface a clear cause instead of returning empty,
		// which otherwise looks indistinguishable from a network failure.
		if (sourceIds.length === 0) {
			throw new Error("No search sources are enabled");
		}
		throw new Error("No enabled sources match the selected search sources");
	}

	const cacheTtl = options.cacheTtl ?? 1000 * 60 * 5;
	const cacheKey = buildCacheKey(
		trimmed,
		activeSources.map((s) => s.id),
	);
	const cached = searchCache.get(cacheKey);
	if (cached && isCacheValid(cached, cacheTtl)) {
		return cached.results;
	}

	const results: SearchResult[] = [];
	const errors: Error[] = [];

	await Promise.all(
		activeSources.map(async (source) => {
			try {
				await throttleSource(source.id);
				const sourceResults = await searchSourceByType(trimmed, source);
				results.push(...sourceResults);
			} catch (error) {
				errors.push(error as Error);
			}
		}),
	);

	const deduped = dedupeResults(results);
	const sorted = deduped.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

	if (sorted.length === 0 && errors.length > 0) {
		throw new Error("Search failed for all sources");
	}

	searchCache.set(cacheKey, { timestamp: Date.now(), results: sorted });
	return sorted;
};


