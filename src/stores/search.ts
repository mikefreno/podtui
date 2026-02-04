/**
 * Search store for PodTUI
 * Manages search state, history, and results
 */

import { createSignal } from "solid-js"
import type { Podcast } from "../types/podcast"
import type { PodcastSource, SearchResult } from "../types/source"

const STORAGE_KEY = "podtui_search_history"
const MAX_HISTORY = 20

export interface SearchState {
  query: string
  isSearching: boolean
  results: SearchResult[]
  error: string | null
}

/** Mock search results for demonstration */
const MOCK_PODCASTS: Podcast[] = [
  {
    id: "search-1",
    title: "Tech Talk Daily",
    description: "Daily technology news and analysis from Silicon Valley experts.",
    feedUrl: "https://example.com/techtalk.rss",
    author: "Tech Media Group",
    categories: ["Technology", "News"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "search-2",
    title: "The Science Hour",
    description: "Weekly deep dives into the latest scientific discoveries and research.",
    feedUrl: "https://example.com/sciencehour.rss",
    author: "Science Network",
    categories: ["Science", "Education"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "search-3",
    title: "History Lessons",
    description: "Fascinating stories from history that shaped our world.",
    feedUrl: "https://example.com/historylessons.rss",
    author: "History Channel",
    categories: ["History", "Education"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "search-4",
    title: "Business Insights",
    description: "Expert analysis on business trends, markets, and entrepreneurship.",
    feedUrl: "https://example.com/businessinsights.rss",
    author: "Business Weekly",
    categories: ["Business", "Finance"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "search-5",
    title: "True Crime Stories",
    description: "In-depth investigations into real criminal cases and mysteries.",
    feedUrl: "https://example.com/truecrime.rss",
    author: "Crime Network",
    categories: ["True Crime", "Documentary"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "search-6",
    title: "Comedy Hour",
    description: "Stand-up comedy, sketches, and hilarious conversations.",
    feedUrl: "https://example.com/comedyhour.rss",
    author: "Laugh Factory",
    categories: ["Comedy", "Entertainment"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "search-7",
    title: "Mindful Living",
    description: "Meditation, wellness, and mental health tips for a better life.",
    feedUrl: "https://example.com/mindful.rss",
    author: "Wellness Media",
    categories: ["Health", "Self-Help"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "search-8",
    title: "Sports Central",
    description: "Coverage of all major sports, analysis, and athlete interviews.",
    feedUrl: "https://example.com/sportscentral.rss",
    author: "Sports Network",
    categories: ["Sports", "News"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
]

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
  const [query, setQuery] = createSignal("")
  const [isSearching, setIsSearching] = createSignal(false)
  const [results, setResults] = createSignal<SearchResult[]>([])
  const [error, setError] = createSignal<string | null>(null)
  const [history, setHistory] = createSignal<string[]>(loadHistory())
  const [selectedSources, setSelectedSources] = createSignal<string[]>([])

  /** Perform search (mock implementation) */
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

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500))

    try {
      // Mock search - filter by query
      const queryLower = q.toLowerCase()
      const matchingPodcasts = MOCK_PODCASTS.filter(
        (p) =>
          p.title.toLowerCase().includes(queryLower) ||
          p.description.toLowerCase().includes(queryLower) ||
          p.categories?.some((c) => c.toLowerCase().includes(queryLower)) ||
          p.author?.toLowerCase().includes(queryLower)
      )

      // Convert to search results
      const searchResults: SearchResult[] = matchingPodcasts.map((podcast, i) => ({
        sourceId: i % 2 === 0 ? "itunes" : "rss",
        podcast,
        score: 1 - i * 0.1, // Mock relevance score
      }))

      setResults(searchResults)
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
