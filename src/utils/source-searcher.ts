import type { Podcast } from "../types/podcast"
import { SourceType } from "../types/source"
import type { PodcastSource, SearchResult } from "../types/source"

type SearcherResult = SearchResult[]

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

type ItunesResult = {
  collectionId?: number
  collectionName?: string
  artistName?: string
  /** Null for shows delisted from Apple Podcasts (directory stub records). */
  feedUrl?: string | null
  artworkUrl100?: string
  artworkUrl600?: string
  primaryGenreName?: string
  releaseDate?: string
  collectionViewUrl?: string
}

type ItunesResponse = {
  resultCount: number
  results: ItunesResult[]
}

const buildItunesUrl = (query: string, source: PodcastSource) => {
  const baseUrl = source.baseUrl?.trim() || "https://itunes.apple.com/search"
  const url = new URL(baseUrl)
  const params = url.searchParams

  params.set("term", query.trim())
  params.set("media", "podcast")
  params.set("entity", "podcast")
  params.set("country", source.country ?? "US")
  params.set("lang", source.language ?? "en_us")
  params.set("explicit", source.allowExplicit === false ? "No" : "Yes")

  return url.toString()
}

export const mapItunesResult = (result: ItunesResult, source: PodcastSource): Podcast | null => {
  if (!result.collectionName) return null

  const id = result.collectionId
    ? `itunes-${result.collectionId}`
    : `itunes-${slugify(result.collectionName)}`

  const descriptionParts = [result.collectionName]
  if (result.artistName) descriptionParts.push(`by ${result.artistName}`)
  if (result.primaryGenreName) descriptionParts.push(result.primaryGenreName)

  // Shows delisted from Apple Podcasts (e.g. The Daily Wire's shows) come back
  // as metadata-only stub records with feedUrl null. Keep the stub so the show
  // stays findable; the real feed is resolved from the directory page at
  // subscribe time (see itunes-feed-resolver).
  const feedUrl = result.feedUrl ?? ""

  return {
    id,
    title: result.collectionName,
    description: descriptionParts.join(" • "),
    feedUrl,
    directoryUrl: feedUrl ? undefined : result.collectionViewUrl,
    author: result.artistName,
    categories: result.primaryGenreName ? [result.primaryGenreName] : undefined,
    coverUrl: result.artworkUrl600 || result.artworkUrl100,
    lastUpdated: result.releaseDate ? new Date(result.releaseDate) : new Date(),
    isSubscribed: false,
  }
}

const searchAPISource = async (
  query: string,
  source: PodcastSource
): Promise<SearcherResult> => {
  const url = buildItunesUrl(query, source)
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`iTunes search failed: ${response.status}`)
  }

  const data = (await response.json()) as ItunesResponse
  const results = data.results
    .map((item) => mapItunesResult(item, source))
    .filter((item): item is Podcast => Boolean(item))

  return results.map((podcast, index) => ({
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    podcast,
    score: 1 - index * 0.02,
  }))
}

/**
 * RSS-type sources have no directory search backend: a feed URL identifies one
 * show, and no API exists to search across "the RSS directory". Return no
 * results rather than fabricating them.
 */
const searchRSSSource = async (): Promise<SearcherResult> => []

/**
 * Custom sources are RSS feeds added by URL (SourceManager) — same
 * no-backend story, so they contribute nothing to directory search.
 */
const searchCustomSource = async (): Promise<SearcherResult> => []

export const searchSourceByType = async (
  query: string,
  source: PodcastSource
): Promise<SearcherResult> => {
  if (source.type === SourceType.RSS) {
    return searchRSSSource()
  }
  if (source.type === SourceType.CUSTOM) {
    return searchCustomSource()
  }
  return searchAPISource(query, source)
}
