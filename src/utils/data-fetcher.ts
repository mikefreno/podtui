import { FeedVisibility } from "../types/feed"
import type { Feed } from "../types/feed"
import type { Episode } from "../types/episode"
import type { Podcast } from "../types/podcast"
import { cacheValue, getCachedValue } from "./cache"
import { fetchEpisodes } from "@/api/client"

const feedKey = (feedUrl: string) => `feed:${feedUrl}`
const episodesKey = (feedUrl: string) => `episodes:${feedUrl}`
const searchKey = (query: string) => `search:${query.toLowerCase()}`

export const fetchFeedWithCache = async (feedUrl: string): Promise<Feed | null> => {
  const cached = getCachedValue<Feed>(feedKey(feedUrl))
  if (cached) return cached
  try {
    const episodes = await fetchEpisodes(feedUrl)
    const feed: Feed = {
      id: feedUrl,
      podcast: {
        id: feedUrl,
        title: feedUrl,
        description: "",
        feedUrl,
        lastUpdated: new Date(),
        isSubscribed: true,
      },
      episodes,
      visibility: FeedVisibility.PUBLIC,
      sourceId: "rss",
      lastUpdated: new Date(),
      isPinned: false,
    }
    cacheValue(feedKey(feedUrl), feed)
    return feed
  } catch {
    return null
  }
}

export const fetchEpisodesWithCache = async (feedUrl: string): Promise<Episode[]> => {
  const cached = getCachedValue<Episode[]>(episodesKey(feedUrl))
  if (cached) return cached
  const episodes = await fetchEpisodes(feedUrl)
  cacheValue(episodesKey(feedUrl), episodes)
  return episodes
}

export const searchWithCache = async (
  query: string,
  fetcher: () => Promise<Podcast[]>
): Promise<Podcast[]> => {
  const cached = getCachedValue<Podcast[]>(searchKey(query))
  if (cached) return cached
  const results = await fetcher()
  cacheValue(searchKey(query), results)
  return results
}
