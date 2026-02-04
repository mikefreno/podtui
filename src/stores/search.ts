/**
 * Search store for PodTUI
 * Manages search state, history, and results
 */

import { createSignal } from "solid-js"
import { searchPodcasts } from "../utils/search"
import { useFeedStore } from "./feed"
import type { SearchResult } from "../types/source"

const STORAGE_KEY = "podtui_search_history"
const MAX_HISTORY = 20

export interface SearchState {
  query: string
  isSearching: boolean
  results: SearchResult[]
  error: string | null
}

const CACHE_TTL = 1000 * 60 * 5

/** Load search history from localStorage */
function loadHistory(): string[] {
  if (typeof localStorage === "undefined") return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/** Save search history to localStorage */
function saveHistory(history: string[]): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // Ignore errors
  }
}

/** Create search store */
export function createSearchStore() {
  const feedStore = useFeedStore()
  const [query, setQuery] = createSignal("")
  const [isSearching, setIsSearching] = createSignal(false)
  const [results, setResults] = createSignal<SearchResult[]>([])
  const [error, setError] = createSignal<string | null>(null)
  const [history, setHistory] = createSignal<string[]>(loadHistory())
  const [selectedSources, setSelectedSources] = createSignal<string[]>([])

  const applySubscribedStatus = (items: SearchResult[]): SearchResult[] => {
    const feeds = feedStore.feeds()
    const subscribedUrls = new Set(feeds.map((feed) => feed.podcast.feedUrl))
    const subscribedIds = new Set(feeds.map((feed) => feed.podcast.id))

    return items.map((item) => ({
      ...item,
      podcast: {
        ...item.podcast,
        isSubscribed:
          item.podcast.isSubscribed ||
          subscribedUrls.has(item.podcast.feedUrl) ||
          subscribedIds.has(item.podcast.id),
      },
    }))
  }

  /** Perform search (multi-source implementation) */
  const search = async (searchQuery: string): Promise<void> => {
    const q = searchQuery.trim()
    if (!q) {
      setResults([])
      return
    }

    setQuery(q)
    setIsSearching(true)
    setError(null)

    // Add to history
    addToHistory(q)

    try {
      const sources = feedStore.sources()
      const enabledSourceIds = sources.filter((s) => s.enabled).map((s) => s.id)
      const sourceIds = selectedSources().length > 0
        ? selectedSources()
        : enabledSourceIds

      const searchResults = await searchPodcasts(q, sourceIds, sources, {
        cacheTtl: CACHE_TTL,
      })

      setResults(applySubscribedStatus(searchResults))
    } catch (e) {
      setError("Search failed. Please try again.")
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  /** Add query to history */
  const addToHistory = (q: string) => {
    setHistory((prev) => {
      // Remove duplicates and add to front
      const filtered = prev.filter((h) => h.toLowerCase() !== q.toLowerCase())
      const updated = [q, ...filtered].slice(0, MAX_HISTORY)
      saveHistory(updated)
      return updated
    })
  }

  /** Clear search history */
  const clearHistory = () => {
    setHistory([])
    saveHistory([])
  }

  /** Remove single history item */
  const removeFromHistory = (q: string) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h !== q)
      saveHistory(updated)
      return updated
    })
  }

  /** Clear results */
  const clearResults = () => {
    setResults([])
    setQuery("")
    setError(null)
  }

  /** Mark a podcast as subscribed in results */
  const markSubscribed = (podcastId: string, feedUrl?: string) => {
    setResults((prev) =>
      prev.map((result) => {
        const matchesId = result.podcast.id === podcastId
        const matchesUrl = feedUrl ? result.podcast.feedUrl === feedUrl : false
        if (matchesId || matchesUrl) {
          return {
            ...result,
            podcast: {
              ...result.podcast,
              isSubscribed: true,
            },
          }
        }
        return result
      })
    )
  }

  return {
    // State
    query,
    isSearching,
    results,
    error,
    history,
    selectedSources,

    // Actions
    search,
    setQuery,
    clearResults,
    clearHistory,
    removeFromHistory,
    setSelectedSources,
    markSubscribed,
  }
}

/** Singleton search store */
let searchStoreInstance: ReturnType<typeof createSearchStore> | null = null

export function useSearchStore() {
  if (!searchStoreInstance) {
    searchStoreInstance = createSearchStore()
  }
  return searchStoreInstance
}
