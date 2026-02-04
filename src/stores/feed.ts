/**
 * Feed store for PodTUI
 * Manages feed data, sources, and filtering
 */

import { createSignal } from "solid-js"
import type { Feed, FeedFilter, FeedVisibility, FeedSortField } from "../types/feed"
import type { Podcast } from "../types/podcast"
import type { Episode, EpisodeStatus } from "../types/episode"
import type { PodcastSource, SourceType } from "../types/source"
import { DEFAULT_SOURCES } from "../types/source"

/** Storage keys */
const STORAGE_KEYS = {
  feeds: "podtui_feeds",
  sources: "podtui_sources",
}

/** Create initial mock feeds for demonstration */
function createMockFeeds(): Feed[] {
  const now = new Date()
  return [
    {
      id: "1",
      podcast: {
        id: "p1",
        title: "The Daily Tech News",
        description: "Your daily dose of technology news and insights from around the world. We cover the latest in AI, software, hardware, and digital culture.",
        feedUrl: "https://example.com/tech.rss",
        author: "Tech Media Inc",
        categories: ["Technology", "News"],
        lastUpdated: now,
        isSubscribed: true,
      },
      episodes: createMockEpisodes("p1", 25),
      visibility: "public" as FeedVisibility,
      sourceId: "rss",
      lastUpdated: now,
      isPinned: true,
    },
    {
      id: "2",
      podcast: {
        id: "p2",
        title: "Code & Coffee",
        description: "Weekly discussions about programming, software development, and the developer lifestyle. Best enjoyed with your morning coffee.",
        feedUrl: "https://example.com/code.rss",
        author: "Developer Collective",
        categories: ["Technology", "Programming"],
        lastUpdated: new Date(Date.now() - 86400000),
        isSubscribed: true,
      },
      episodes: createMockEpisodes("p2", 50),
      visibility: "private" as FeedVisibility,
      sourceId: "rss",
      lastUpdated: new Date(Date.now() - 86400000),
      isPinned: false,
    },
    {
      id: "3",
      podcast: {
        id: "p3",
        title: "Science Explained",
        description: "Breaking down complex scientific topics for curious minds. From quantum physics to biology, we make science accessible.",
        feedUrl: "https://example.com/science.rss",
        author: "Science Network",
        categories: ["Science", "Education"],
        lastUpdated: new Date(Date.now() - 172800000),
        isSubscribed: true,
      },
      episodes: createMockEpisodes("p3", 120),
      visibility: "public" as FeedVisibility,
      sourceId: "itunes",
      lastUpdated: new Date(Date.now() - 172800000),
      isPinned: false,
    },
    {
      id: "4",
      podcast: {
        id: "p4",
        title: "History Uncovered",
        description: "Deep dives into fascinating historical events and figures you never learned about in school.",
        feedUrl: "https://example.com/history.rss",
        author: "History Channel",
        categories: ["History", "Education"],
        lastUpdated: new Date(Date.now() - 259200000),
        isSubscribed: true,
      },
      episodes: createMockEpisodes("p4", 80),
      visibility: "public" as FeedVisibility,
      sourceId: "rss",
      lastUpdated: new Date(Date.now() - 259200000),
      isPinned: true,
    },
    {
      id: "5",
      podcast: {
        id: "p5",
        title: "Startup Stories",
        description: "Founders share their journey from idea to exit. Learn from their successes and failures.",
        feedUrl: "https://example.com/startup.rss",
        author: "Entrepreneur Media",
        categories: ["Business", "Technology"],
        lastUpdated: new Date(Date.now() - 345600000),
        isSubscribed: true,
      },
      episodes: createMockEpisodes("p5", 45),
      visibility: "private" as FeedVisibility,
      sourceId: "itunes",
      lastUpdated: new Date(Date.now() - 345600000),
      isPinned: false,
    },
  ]
}

/** Create mock episodes for a podcast */
function createMockEpisodes(podcastId: string, count: number): Episode[] {
  const episodes: Episode[] = []
  for (let i = 0; i < count; i++) {
    episodes.push({
      id: `${podcastId}-ep-${i + 1}`,
      podcastId,
      title: `Episode ${count - i}: Sample Episode Title`,
      description: `This is the description for episode ${count - i}. It contains interesting content about various topics.`,
      audioUrl: `https://example.com/audio/${podcastId}/${i + 1}.mp3`,
      duration: 1800 + Math.random() * 3600, // 30-90 minutes
      pubDate: new Date(Date.now() - i * 604800000), // Weekly episodes
      episodeNumber: count - i,
    })
  }
  return episodes
}

/** Load feeds from localStorage */
function loadFeeds(): Feed[] {
  if (typeof localStorage === "undefined") {
    return createMockFeeds()
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

  return createMockFeeds()
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

  /** Add a new feed */
  const addFeed = (podcast: Podcast, sourceId: string, visibility: FeedVisibility = "public") => {
    const newFeed: Feed = {
      id: crypto.randomUUID(),
      podcast,
      episodes: [],
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
    addSource,
    removeSource,
    toggleSource,
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
