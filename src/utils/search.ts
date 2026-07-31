import { searchSourceByType } from "./source-searcher";
import type { PodcastSource, SearchResult } from "../types/source";
import type { Episode } from "../types/episode";

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

type ItunesEpisodeResult = {
	trackId?: number;
	trackName?: string;
	description?: string;
	shortDescription?: string;
	releaseDate?: string;
	trackTimeMillis?: number;
	episodeUrl?: string;
	previewUrl?: string;
	trackViewUrl?: string;
};

type ItunesEpisodeResponse = {
	resultCount: number;
	results: ItunesEpisodeResult[];
};

export const searchEpisodes = async (
	query: string,
	feedId: string,
): Promise<Episode[]> => {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const url = new URL("https://itunes.apple.com/search");
	url.searchParams.set("term", trimmed);
	url.searchParams.set("media", "podcast");
	url.searchParams.set("entity", "podcastEpisode");
	url.searchParams.set("country", "US");
	url.searchParams.set("lang", "en_us");

	const response = await fetch(url.toString());
	if (!response.ok) return [];

	const data = (await response.json()) as ItunesEpisodeResponse;
	return data.results
		.map((item) => {
			if (!item.trackName) return null;
			const id = item.trackId
				? `episode-${item.trackId}`
				: `episode-${item.trackName}`;
			const audioUrl =
				item.episodeUrl || item.previewUrl || item.trackViewUrl || "";

			return {
				id,
				podcastId: feedId,
				title: item.trackName,
				description: item.description || item.shortDescription || "",
				audioUrl,
				duration: item.trackTimeMillis
					? Math.round(item.trackTimeMillis / 1000)
					: 0,
				pubDate: item.releaseDate ? new Date(item.releaseDate) : new Date(),
			};
		})
		.filter((item): item is Episode => Boolean(item));
};
