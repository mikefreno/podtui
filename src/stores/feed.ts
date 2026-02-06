/**
 * Feed store for PodTUI
 * Manages feed data, sources, and filtering
 */

import { createSignal } from "solid-js"
import { FeedVisibility } from "../types/feed"
import type { Feed, FeedFilter, FeedSortField } from "../types/feed"
import type { Podcast } from "../types/podcast"
import type { Episode, EpisodeStatus } from "../types/episode"
import type { PodcastSource, SourceType } from "../types/source"
import { DEFAULT_SOURCES } from "../types/source"
import { parseRSSFeed } from "../api/rss-parser"

/** Max episodes to fetch on refresh */
const MAX_EPISODES_REFRESH = 50

/** Max episodes to fetch on initial subscribe */
const MAX_EPISODES_SUBSCRIBE = 20

/** Storage keys */
const STORAGE_KEYS = {
  feeds: "podtui_feeds",
  sources: "podtui_sources",
}

/** Load feeds from localStorage */
function loadFeeds(): Feed[] {
  if (typeof localStorage === "undefined") {
    return []
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.feeds)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Convert date strings
      return parsed.map((feed: Feed) => ({
        ...feed,
        lastUpdated: new Date(feed.lastUpdated),
        podcast: {
          ...feed.podcast,
          lastUpdated: new Date(feed.podcast.lastUpdated),
        },
        episodes: feed.episodes.map((ep: Episode) => ({
          ...ep,
          pubDate: new Date(ep.pubDate),
        })),
      }))
    }
  } catch {
    // Ignore errors
  }

  return []
}

/** Save feeds to localStorage */
function saveFeeds(feeds: Feed[]): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEYS.feeds, JSON.stringify(feeds))
  } catch {
    // Ignore errors
  }
}

/** Load sources from localStorage */
function loadSources(): PodcastSource[] {
  if (typeof localStorage === "undefined") {
    return [...DEFAULT_SOURCES]
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.sources)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore errors
  }

  return [...DEFAULT_SOURCES]
}

/** Save sources to localStorage */
function saveSources(sources: PodcastSource[]): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEYS.sources, JSON.stringify(sources))
  } catch {
    // Ignore errors
  }
}

/** Create feed store */
export function createFeedStore() {
  const [feeds, setFeeds] = createSignal<Feed[]>(loadFeeds())
  const [sources, setSources] = createSignal<PodcastSource[]>(loadSources())
  const [filter, setFilter] = createSignal<FeedFilter>({
    visibility: "all",
    sortBy: "updated" as FeedSortField,
    sortDirection: "desc",
  })
  const [selectedFeedId, setSelectedFeedId] = createSignal<string | null>(null)

  /** Get filtered and sorted feeds */
  const getFilteredFeeds = (): Feed[] => {
    let result = [...feeds()]
    const f = filter()

    // Filter by visibility
    if (f.visibility && f.visibility !== "all") {
      result = result.filter((feed) => feed.visibility === f.visibility)
    }

    // Filter by source
    if (f.sourceId) {
      result = result.filter((feed) => feed.sourceId === f.sourceId)
    }

    // Filter by pinned
    if (f.pinnedOnly) {
      result = result.filter((feed) => feed.isPinned)
    }

    // Filter by search query
    if (f.searchQuery) {
      const query = f.searchQuery.toLowerCase()
      result = result.filter(
        (feed) =>
          feed.podcast.title.toLowerCase().includes(query) ||
          feed.customName?.toLowerCase().includes(query) ||
          feed.podcast.description?.toLowerCase().includes(query)
      )
    }

    // Sort by selected field
    const sortDir = f.sortDirection === "asc" ? 1 : -1
    result.sort((a, b) => {
      switch (f.sortBy) {
        case "title":
          return sortDir * (a.customName || a.podcast.title).localeCompare(b.customName || b.podcast.title)
        case "episodeCount":
          return sortDir * (a.episodes.length - b.episodes.length)
        case "latestEpisode":
          const aLatest = a.episodes[0]?.pubDate?.getTime() || 0
          const bLatest = b.episodes[0]?.pubDate?.getTime() || 0
          return sortDir * (aLatest - bLatest)
        case "updated":
        default:
          return sortDir * (a.lastUpdated.getTime() - b.lastUpdated.getTime())
      }
    })

    // Pinned feeds always first
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })

    return result
  }

  /** Get episodes in reverse chronological order across all feeds */
  const getAllEpisodesChronological = (): Array<{ episode: Episode; feed: Feed }> => {
    const allEpisodes: Array<{ episode: Episode; feed: Feed }> = []
    
    for (const feed of feeds()) {
      for (const episode of feed.episodes) {
        allEpisodes.push({ episode, feed })
      }
    }

    // Sort by publication date (newest first)
    allEpisodes.sort((a, b) => b.episode.pubDate.getTime() - a.episode.pubDate.getTime())

    return allEpisodes
  }

  /** Fetch latest episodes from an RSS feed URL */
  const fetchEpisodes = async (feedUrl: string, limit: number): Promise<Episode[]> => {
    try {
      const response = await fetch(feedUrl, {
        headers: {
          "Accept-Encoding": "identity",
          "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
      })
      if (!response.ok) return []
      const xml = await response.text()
      const parsed = parseRSSFeed(xml, feedUrl)
      return parsed.episodes.slice(0, limit)
    } catch {
      return []
    }
  }

  /** Add a new feed and auto-fetch latest 20 episodes */
  const addFeed = async (podcast: Podcast, sourceId: string, visibility: FeedVisibility = FeedVisibility.PUBLIC) => {
    const episodes = await fetchEpisodes(podcast.feedUrl, MAX_EPISODES_SUBSCRIBE)
    const newFeed: Feed = {
      id: crypto.randomUUID(),
      podcast,
      episodes,
      visibility,
      sourceId,
      lastUpdated: new Date(),
      isPinned: false,
    }
    setFeeds((prev) => {
      const updated = [...prev, newFeed]
      saveFeeds(updated)
      return updated
    })
    return newFeed
  }

  /** Refresh a single feed - re-fetch latest 50 episodes */
  const refreshFeed = async (feedId: string) => {
    const feed = getFeed(feedId)
    if (!feed) return
    const episodes = await fetchEpisodes(feed.podcast.feedUrl, MAX_EPISODES_REFRESH)
    setFeeds((prev) => {
      const updated = prev.map((f) =>
        f.id === feedId ? { ...f, episodes, lastUpdated: new Date() } : f
      )
      saveFeeds(updated)
      return updated
    })
  }

  /** Refresh all feeds */
  const refreshAllFeeds = async () => {
    const currentFeeds = feeds()
    for (const feed of currentFeeds) {
      await refreshFeed(feed.id)
    }
  }

  /** Remove a feed */
  const removeFeed = (feedId: string) => {
    setFeeds((prev) => {
      const updated = prev.filter((f) => f.id !== feedId)
      saveFeeds(updated)
      return updated
    })
  }

  /** Update a feed */
  const updateFeed = (feedId: string, updates: Partial<Feed>) => {
    setFeeds((prev) => {
      const updated = prev.map((f) =>
        f.id === feedId ? { ...f, ...updates, lastUpdated: new Date() } : f
      )
      saveFeeds(updated)
      return updated
    })
  }

  /** Toggle feed pinned status */
  const togglePinned = (feedId: string) => {
    setFeeds((prev) => {
      const updated = prev.map((f) =>
        f.id === feedId ? { ...f, isPinned: !f.isPinned } : f
      )
      saveFeeds(updated)
      return updated
    })
  }

  /** Add a source */
  const addSource = (source: Omit<PodcastSource, "id">) => {
    const newSource: PodcastSource = {
      ...source,
      id: crypto.randomUUID(),
    }
    setSources((prev) => {
      const updated = [...prev, newSource]
      saveSources(updated)
      return updated
    })
    return newSource
  }

  /** Update a source */
  const updateSource = (sourceId: string, updates: Partial<PodcastSource>) => {
    setSources((prev) => {
      const updated = prev.map((source) =>
        source.id === sourceId ? { ...source, ...updates } : source
      )
      saveSources(updated)
      return updated
    })
  }

  /** Remove a source */
  const removeSource = (sourceId: string) => {
    // Don't remove default sources
    if (sourceId === "itunes" || sourceId === "rss") return false
    
    setSources((prev) => {
      const updated = prev.filter((s) => s.id !== sourceId)
      saveSources(updated)
      return updated
    })
    return true
  }

  /** Toggle source enabled status */
  const toggleSource = (sourceId: string) => {
    setSources((prev) => {
      const updated = prev.map((s) =>
        s.id === sourceId ? { ...s, enabled: !s.enabled } : s
      )
      saveSources(updated)
      return updated
    })
  }

  /** Get feed by ID */
  const getFeed = (feedId: string): Feed | undefined => {
    return feeds().find((f) => f.id === feedId)
  }

  /** Get selected feed */
  const getSelectedFeed = (): Feed | undefined => {
    const id = selectedFeedId()
    return id ? getFeed(id) : undefined
  }

  return {
    // State
    feeds,
    sources,
    filter,
    selectedFeedId,
    
    // Computed
    getFilteredFeeds,
    getAllEpisodesChronological,
    getFeed,
    getSelectedFeed,
    
    // Actions
    setFilter,
    setSelectedFeedId,
    addFeed,
    removeFeed,
    updateFeed,
    togglePinned,
    refreshFeed,
    refreshAllFeeds,
    addSource,
    removeSource,
    toggleSource,
    updateSource,
  }
}

/** Singleton feed store */
let feedStoreInstance: ReturnType<typeof createFeedStore> | null = null

export function useFeedStore() {
  if (!feedStoreInstance) {
    feedStoreInstance = createFeedStore()
  }
  return feedStoreInstance
}
