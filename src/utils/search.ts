import { searchSourceByType } from "./source-searcher"
import type { PodcastSource, SearchResult } from "../types/source"
import type { Episode } from "../types/episode"

type SearchCacheEntry = {
  timestamp: number
  results: SearchResult[]
}

type SearchOptions = {
  cacheTtl?: number
}

const searchCache = new Map<string, SearchCacheEntry>()

const buildCacheKey = (query: string, sourceIds: string[]) => {
  const keySources = [...sourceIds].sort().join(",")
  return `${query.toLowerCase()}::${keySources}`
}

const isCacheValid = (entry: SearchCacheEntry, ttl: number) =>
  Date.now() - entry.timestamp < ttl

const dedupeResults = (results: SearchResult[]): SearchResult[] => {
  const map = new Map<string, SearchResult>()
  for (const result of results) {
    const key = result.podcast.feedUrl || result.podcast.id || result.podcast.title
    const existing = map.get(key)
    if (!existing || (result.score ?? 0) > (existing.score ?? 0)) {
      map.set(key, result)
    }
  }
  return Array.from(map.values())
}

export const searchPodcasts = async (
  query: string,
  sourceIds: string[],
  sources: PodcastSource[],
  options: SearchOptions = {}
): Promise<SearchResult[]> => {
  const trimmed = query.trim()
  if (!trimmed) return []

  const activeSources = sources.filter(
    (source) => sourceIds.includes(source.id) && source.enabled
  )

  if (activeSources.length === 0) return []

  const cacheTtl = options.cacheTtl ?? 1000 * 60 * 5
  const cacheKey = buildCacheKey(trimmed, activeSources.map((s) => s.id))
  const cached = searchCache.get(cacheKey)
  if (cached && isCacheValid(cached, cacheTtl)) {
    return cached.results
  }

  const results: SearchResult[] = []
  const errors: Error[] = []

  await Promise.all(
    activeSources.map(async (source) => {
      try {
        const sourceResults = await searchSourceByType(trimmed, source)
        results.push(...sourceResults)
      } catch (error) {
        errors.push(error as Error)
      }
    })
  )

  const deduped = dedupeResults(results)
  const sorted = deduped.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  if (sorted.length === 0 && errors.length > 0) {
    throw new Error("Search failed for all sources")
  }

  searchCache.set(cacheKey, { timestamp: Date.now(), results: sorted })
  return sorted
}

export const searchEpisodes = async (
  query: string,
  _feedId: string
): Promise<Episode[]> => {
  const trimmed = query.trim()
  if (!trimmed) return []
  await new Promise((resolve) => setTimeout(resolve, 200))
  return []
}
