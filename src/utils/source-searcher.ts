import type { Podcast } from "../types/podcast"
import type { Episode } from "../types/episode"
import { SourceType } from "../types/source"
import type { PodcastSource, SearchResult } from "../types/source"
import { detectContentType, ContentType } from "../utils/rss-content-detector"
import { htmlToText } from "../utils/html-to-text"
import { resolveSourceCredentials } from "../utils/source-credentials"

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

type ItunesEpisodeResult = {
  trackId?: number
  trackName?: string
  collectionId?: number
  collectionName?: string
  artistName?: string
  description?: string
  /** Null for episodes of delisted shows (directory stub records). */
  feedUrl?: string | null
  episodeUrl?: string
  /** Duration in milliseconds. */
  trackTimeMillis?: number
  releaseDate?: string
  artworkUrl100?: string
  artworkUrl600?: string
  primaryGenreName?: string
  trackViewUrl?: string
  collectionViewUrl?: string
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

/** Same as buildItunesUrl but targets episodes instead of shows — this is how
 *  guest/name searches find specific episodes (the term matches episode titles
 *  and show notes). */
const buildItunesEpisodeUrl = (query: string, source: PodcastSource) => {
  const baseUrl = source.baseUrl?.trim() || "https://itunes.apple.com/search"
  const url = new URL(baseUrl)
  const params = url.searchParams

  params.set("term", query.trim())
  params.set("media", "podcast")
  params.set("entity", "podcastEpisode")
  params.set("country", source.country ?? "US")
  params.set("lang", source.language ?? "en_us")
  params.set("explicit", source.allowExplicit === false ? "No" : "Yes")

  return url.toString()
}

// ── Podcast Index (fallback directory) ─────────────────────────────────────
// Open, community-run directory that includes shows Apple never lists or has
// delisted. Requires a user-supplied key + secret (podcastindex.org) and is
// used only as a fallback when primary sources return few results (see
// search.ts). Feed-first: results carry the feed URL directly, so there is no
// delisted-show stub resolution step like iTunes has.

type PodcastIndexResult = {
  id?: number
  title?: string
  /** Current feed URL. */
  url?: string
  /** Show website. */
  link?: string
  description?: string
  author?: string
  image?: string
  artwork?: string
  /** Unix epoch seconds of the feed's last update. */
  lastUpdateTime?: number
  /** Apple directory id when known (nullable — not all shows are on Apple). */
  itunesId?: number | null
  language?: string
  explicit?: boolean
  /** True when the feed is unreachable — drop these. */
  dead?: boolean
  episodeCount?: number
  /** Category id -> name. */
  categories?: Record<string, string>
  newestItemPubdate?: number
}

type PodcastIndexResponse = {
  status?: string | boolean
  feeds?: PodcastIndexResult[]
}

const sha1Hex = async (input: string): Promise<string> => {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-1", data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

/** Podcast Index auth is header-based: X-Auth-Key + X-Auth-Date (unix epoch
 *  seconds) + Authorization = sha1(key + secret + epoch). No query params.
 *  Credentials resolve from the source's storage backend: the OS keychain
 *  (encrypted at rest) by default, or the source's plaintext fields when the
 *  keychain was unavailable at save time. */
const buildPodcastIndexHeaders = async (
  source: PodcastSource,
): Promise<Record<string, string>> => {
  const credentials = await resolveSourceCredentials(source)
  const key = credentials?.apiKey
  const secret = credentials?.apiSecret
  if (!key || !secret) {
    throw new Error(
      `${source.name} credentials are missing — enable the source in Settings → Sources to enter them`,
    )
  }
  const epoch = Math.floor(Date.now() / 1000).toString()
  const signature = await sha1Hex(key + secret + epoch)
  return {
    "User-Agent": "PodTUI/1.0",
    "X-Auth-Key": key,
    "X-Auth-Date": epoch,
    Authorization: signature,
  }
}

const buildPodcastIndexUrl = (query: string, source: PodcastSource) => {
  const url = new URL(source.baseUrl)
  url.searchParams.set("q", query.trim())
  url.searchParams.set("max", "25")
  return url.toString()
}

export const mapPodcastIndexResult = (
  result: PodcastIndexResult,
  source: PodcastSource,
): Podcast | null => {
  if (!result.title || !result.url) return null

  const id = result.id
    ? `podcastindex-${result.id}`
    : `podcastindex-${slugify(result.title)}`

  const descriptionParts = [result.title]
  if (result.author) descriptionParts.push(`by ${result.author}`)
  if (result.episodeCount !== undefined)
    descriptionParts.push(`${result.episodeCount} episodes`)

  return {
    id,
    title: result.title,
    description: descriptionParts.join(" • "),
    feedUrl: result.url,
    author: result.author,
    categories: result.categories
      ? Object.values(result.categories)
      : undefined,
    coverUrl: result.image || result.artwork,
    language: result.language,
    websiteUrl: result.link,
    lastUpdated: result.lastUpdateTime
      ? new Date(result.lastUpdateTime * 1000)
      : new Date(),
    isSubscribed: false,
  }
}

const searchPodcastIndexSource = async (
  query: string,
  source: PodcastSource,
): Promise<SearcherResult> => {
  const headers = await buildPodcastIndexHeaders(source)
  const response = await fetch(buildPodcastIndexUrl(query, source), {
    headers,
  })

  if (!response.ok) {
    throw new Error(`${source.name} search failed: ${response.status}`)
  }

  const data = (await response.json()) as PodcastIndexResponse
  const results = (data.feeds ?? [])
    .filter((item) => !item.dead)
    .map((item) => mapPodcastIndexResult(item, source))
    .filter((item): item is Podcast => Boolean(item))

  return results.map((podcast, index) => ({
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    kind: "podcast" as const,
    podcast,
    score: 1 - index * 0.02,
  }))
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

/**
 * Clean an iTunes description: detect HTML vs plain text and convert HTML to
 * readable plain text (mirrors rss-parser's cleanField). iTunes show notes
 * are often raw HTML.
 */
const cleanDescription = (raw: string): string => {
  if (!raw) return ""
  const decoded = raw
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  if (detectContentType(decoded) === ContentType.HTML) {
    return htmlToText(decoded)
  }
  return decoded
}

/**
 * Map an iTunes episode record to a search result: the episode itself plus its
 * parent show (as a Podcast) so subscribing works exactly like a show result.
 * Returns null when the record is missing a track or collection name.
 */
export const mapItunesEpisodeResult = (
  result: ItunesEpisodeResult,
  source: PodcastSource,
): { podcast: Podcast; episode: Episode } | null => {
  if (!result.trackName || !result.collectionName) return null

  const podcast = mapItunesResult(result, source)
  if (!podcast) return null

  const episode: Episode = {
    id: result.trackId
      ? `itunes-ep-${result.trackId}`
      : `itunes-ep-${slugify(result.trackName)}`,
    podcastId: podcast.id,
    title: result.trackName,
    description: cleanDescription(result.description ?? ""),
    audioUrl: result.episodeUrl ?? "",
    duration: result.trackTimeMillis
      ? Math.round(result.trackTimeMillis / 1000)
      : 0,
    pubDate: result.releaseDate ? new Date(result.releaseDate) : new Date(),
  }

  return { podcast, episode }
}

const searchItunesSource = async (
  query: string,
  source: PodcastSource
): Promise<SearcherResult> => {
  const url = buildItunesUrl(query, source)
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`${source.name} search failed: ${response.status}`)
  }

  const data = (await response.json()) as ItunesResponse
  const results = data.results
    .map((item) => mapItunesResult(item, source))
    .filter((item): item is Podcast => Boolean(item))

  return results.map((podcast, index) => ({
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    kind: "podcast" as const,
    podcast,
    score: 1 - index * 0.02,
  }))
}

/** Dispatch API-source search by source id: iTunes is the primary directory,
 *  Podcast Index the user-configured fallback (also usable directly). */
const searchAPISource = async (
  query: string,
  source: PodcastSource
): Promise<SearcherResult> => {
  switch (source.id) {
    case "podcastindex":
      return searchPodcastIndexSource(query, source)
    default:
      return searchItunesSource(query, source)
  }
}

const searchItunesEpisodeSource = async (
  query: string,
  source: PodcastSource
): Promise<SearcherResult> => {
  const url = buildItunesEpisodeUrl(query, source)
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`${source.name} episode search failed: ${response.status}`)
  }

  const data = (await response.json()) as { results: ItunesEpisodeResult[] }
  const results = data.results
    .map((item) => mapItunesEpisodeResult(item, source))
    .filter(
      (item): item is { podcast: Podcast; episode: Episode } => Boolean(item),
    )

  return results.map(({ podcast, episode }, index) => ({
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    kind: "episode" as const,
    podcast,
    episode,
    score: 1 - index * 0.02,
  }))
}

/** Episode-scope API dispatch: only iTunes supports episode-by-term text
 *  search; Podcast Index has no such endpoint (its episode search is
 *  by-person only), so it contributes nothing to episode scope. */
const searchEpisodeAPISource = async (
  query: string,
  source: PodcastSource
): Promise<SearcherResult> => {
  if (source.id === "podcastindex") return []
  return searchItunesEpisodeSource(query, source)
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

/**
 * Episode-scope dispatch: same backend rules as searchSourceByType — only
 * API sources (iTunes) can search episodes; RSS/custom sources have no
 * directory backend.
 */
export const searchEpisodesByType = async (
  query: string,
  source: PodcastSource
): Promise<SearcherResult> => {
  if (source.type === SourceType.RSS) {
    return searchRSSSource()
  }
  if (source.type === SourceType.CUSTOM) {
    return searchCustomSource()
  }
  return searchEpisodeAPISource(query, source)
}
