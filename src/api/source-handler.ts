import { FeedVisibility } from "../types/feed"
import type { Feed } from "../types/feed"
import type { PodcastSource } from "../types/source"
import type { Podcast } from "../types/podcast"
import { parseRSSFeed } from "./rss-parser"

const buildFeedFromPodcast = (podcast: Podcast, sourceId: string): Feed => {
  return {
    id: `${sourceId}-${podcast.id}`,
    podcast,
    episodes: [],
    visibility: FeedVisibility.PUBLIC,
    sourceId,
    lastUpdated: new Date(),
    isPinned: false,
  }
}

export const handleRSSSource = async (source: PodcastSource): Promise<Feed[]> => {
  if (!source.baseUrl) return []
  const response = await fetch(source.baseUrl)
  if (!response.ok) return []
  const xml = await response.text()
  const parsed = parseRSSFeed(xml, source.baseUrl)
  return [
    {
      id: `${source.id}-${parsed.feedUrl}`,
      podcast: {
        id: parsed.id,
        title: parsed.title,
        description: parsed.description,
        feedUrl: parsed.feedUrl,
        author: parsed.author,
        categories: parsed.categories,
        lastUpdated: parsed.lastUpdated,
        isSubscribed: true,
      },
      episodes: parsed.episodes,
      visibility: FeedVisibility.PUBLIC,
      sourceId: source.id,
      lastUpdated: parsed.lastUpdated,
      isPinned: false,
    },
  ]
}

export const handleAPISource = async (
  source: PodcastSource,
  query: string
): Promise<Feed[]> => {
  const url = new URL(source.baseUrl || "https://itunes.apple.com/search")
  url.searchParams.set("term", query || "podcast")
  url.searchParams.set("media", "podcast")
  url.searchParams.set("entity", "podcast")
  url.searchParams.set("country", source.country || "US")
  url.searchParams.set("lang", source.language || "en_us")

  const response = await fetch(url.toString())
  if (!response.ok) return []
  const data = (await response.json()) as { results?: Array<{ collectionId?: number; collectionName?: string; feedUrl?: string; artistName?: string }> }
  const results = data.results ?? []

  return results
    .filter((item) => item.collectionName && item.feedUrl)
    .map((item) => {
      const podcast: Podcast = {
        id: item.collectionId ? `itunes-${item.collectionId}` : `${source.id}-${item.collectionName}`,
        title: item.collectionName || "Untitled Podcast",
        description: item.collectionName || "",
        feedUrl: item.feedUrl || "",
        author: item.artistName,
        lastUpdated: new Date(),
        isSubscribed: false,
      }
      return buildFeedFromPodcast(podcast, source.id)
    })
}

export const handleCustomSource = async (
  source: PodcastSource,
  query: string
): Promise<Feed[]> => {
  if (!query) return []
  const podcast: Podcast = {
    id: `${source.id}-${query.toLowerCase().replace(/\s+/g, "-")}`,
    title: `${query} Highlights`,
    description: `Curated results for ${query}`,
    feedUrl: source.baseUrl || "",
    author: source.name,
    lastUpdated: new Date(),
    isSubscribed: false,
  }
  return [buildFeedFromPodcast(podcast, source.id)]
}
