import type { Feed } from "../types/feed"
import type { Episode } from "../types/episode"
import type { Podcast } from "../types/podcast"
import type { PodcastSource } from "../types/source"
import { parseRSSFeed } from "@/api/rss-parser"
import { handleAPISource, handleCustomSource, handleRSSSource } from "@/api/source-handler"

export const fetchEpisodes = async (feedUrl: string): Promise<Episode[]> => {
  try {
    const response = await fetch(feedUrl)
    if (!response.ok) return []
    const xml = await response.text()
    return parseRSSFeed(xml, feedUrl).episodes
  } catch {
    return []
  }
}

export const fetchFeeds = async (
  sourceIds: string[],
  sources: PodcastSource[]
): Promise<Feed[]> => {
  const active = sources.filter((source) => sourceIds.includes(source.id))
  const feeds: Feed[] = []

  await Promise.all(
    active.map(async (source) => {
      try {
        if (source.type === "rss") {
          const rssFeeds = await handleRSSSource(source)
          feeds.push(...rssFeeds)
        } else if (source.type === "api") {
          const apiFeeds = await handleAPISource(source, "")
          feeds.push(...apiFeeds)
        } else {
          const customFeeds = await handleCustomSource(source, "")
          feeds.push(...customFeeds)
        }
      } catch {
        // ignore individual source errors
      }
    })
  )

  return feeds
}

export const searchPodcasts = async (
  query: string,
  sources: PodcastSource[]
): Promise<Podcast[]> => {
  const results: Podcast[] = []
  await Promise.all(
    sources.map(async (source) => {
      try {
        if (source.type === "rss") {
          const feeds = await handleRSSSource(source)
          results.push(...feeds.map((feed: Feed) => feed.podcast))
        } else if (source.type === "api") {
          const feeds = await handleAPISource(source, query)
          results.push(...feeds.map((feed: Feed) => feed.podcast))
        } else {
          const feeds = await handleCustomSource(source, query)
          results.push(...feeds.map((feed: Feed) => feed.podcast))
        }
      } catch {
        // ignore errors
      }
    })
  )

  return results
}
