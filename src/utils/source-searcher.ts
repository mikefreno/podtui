import type { Podcast } from "../types/podcast"
import { SourceType } from "../types/source"
import type { PodcastSource, SearchResult } from "../types/source"

type SearcherResult = SearchResult[]

const delay = async (min = 200, max = 500) =>
  new Promise((resolve) => setTimeout(resolve, min + Math.random() * max))

const hashString = (input: string): number => {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const sourceLabel = (source: PodcastSource): string =>
  source.name || source.id

const buildPodcast = (
  idBase: string,
  title: string,
  description: string,
  author: string,
  categories: string[],
  source: PodcastSource
): Podcast => ({
  id: idBase,
  title,
  description,
  feedUrl: `https://example.com/${slugify(title)}/feed.xml`,
  author,
  categories,
  lastUpdated: new Date(),
  isSubscribed: false,
})

const makeResults = (query: string, source: PodcastSource, seedOffset = 0): SearcherResult => {
  const seed = hashString(`${source.id}:${query}`) + seedOffset
  const baseTitles = [
    "Daily Briefing",
    "Studio Sessions",
    "Signal & Noise",
    "The Long Play",
    "Off the Record",
  ]
  const descriptors = [
    "Deep dives into",
    "A fast-paced look at",
    "Smart conversations about",
    "A weekly roundup of",
    "Curated stories on",
  ]
  const categories = ["Technology", "Business", "Science", "Culture", "News"]

  return baseTitles.map((base, index) => {
    const title = `${query} ${base}`
    const desc = `${descriptors[index % descriptors.length]} ${query.toLowerCase()} from ${sourceLabel(source)}.`
    const author = `${sourceLabel(source)} Network`
    const cat = [categories[(seed + index) % categories.length]]
    const podcast = buildPodcast(
      `search-${source.id}-${seed + index}`,
      title,
      desc,
      author,
      cat,
      source
    )

    return {
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      podcast,
      score: 1 - index * 0.08,
    }
  })
}

export const searchRSSSource = async (
  query: string,
  source: PodcastSource
): Promise<SearcherResult> => {
  await delay(200, 450)
  return makeResults(query, source, 1)
}

type ItunesResult = {
  collectionId?: number
  collectionName?: string
  artistName?: string
  feedUrl?: string
  artworkUrl100?: string
  artworkUrl600?: string
  primaryGenreName?: string
  releaseDate?: string
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

const mapItunesResult = (result: ItunesResult, source: PodcastSource): Podcast | null => {
  if (!result.collectionName || !result.feedUrl) return null

  const id = result.collectionId
    ? `itunes-${result.collectionId}`
    : `itunes-${slugify(result.collectionName)}`

  const descriptionParts = [result.collectionName]
  if (result.artistName) descriptionParts.push(`by ${result.artistName}`)
  if (result.primaryGenreName) descriptionParts.push(result.primaryGenreName)

  return {
    id,
    title: result.collectionName,
    description: descriptionParts.join(" • "),
    feedUrl: result.feedUrl,
    author: result.artistName,
    categories: result.primaryGenreName ? [result.primaryGenreName] : undefined,
    coverUrl: result.artworkUrl600 || result.artworkUrl100,
    lastUpdated: result.releaseDate ? new Date(result.releaseDate) : new Date(),
    isSubscribed: false,
  }
}

export const searchAPISource = async (
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

export const searchCustomSource = async (
  query: string,
  source: PodcastSource
): Promise<SearcherResult> => {
  await delay(300, 650)
  return makeResults(query, source, 13)
}

export const searchSourceByType = async (
  query: string,
  source: PodcastSource
): Promise<SearcherResult> => {
  if (source.type === SourceType.RSS) {
    return searchRSSSource(query, source)
  }
  if (source.type === SourceType.CUSTOM) {
    return searchCustomSource(query, source)
  }
  return searchAPISource(query, source)
}
