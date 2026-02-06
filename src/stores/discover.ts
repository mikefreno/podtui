/**
 * Discover store for PodTUI
 * Manages trending/popular podcasts and category filtering
 */

import { createSignal } from "solid-js"
import type { Podcast } from "../types/podcast"

export interface DiscoverCategory {
  id: string
  name: string
  icon: string
}

export const DISCOVER_CATEGORIES: DiscoverCategory[] = [
  { id: "all", name: "All", icon: "*" },
  { id: "technology", name: "Technology", icon: ">" },
  { id: "science", name: "Science", icon: "~" },
  { id: "comedy", name: "Comedy", icon: ")" },
  { id: "news", name: "News", icon: "!" },
  { id: "business", name: "Business", icon: "$" },
  { id: "health", name: "Health", icon: "+" },
  { id: "education", name: "Education", icon: "?" },
  { id: "sports", name: "Sports", icon: "#" },
  { id: "true-crime", name: "True Crime", icon: "%" },
  { id: "arts", name: "Arts", icon: "@" },
]

/** Mock trending podcasts */
const TRENDING_PODCASTS: Podcast[] = [
  {
    id: "trend-1",
    title: "AI Today",
    description: "The latest developments in artificial intelligence, machine learning, and their impact on society.",
    feedUrl: "https://example.com/aitoday.rss",
    author: "Tech Futures",
    categories: ["Technology", "Science"],
    coverUrl: undefined,
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "trend-2",
    title: "The History Hour",
    description: "Fascinating stories from history that shaped our world today.",
    feedUrl: "https://example.com/historyhour.rss",
    author: "History Channel",
    categories: ["Education", "History"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "trend-3",
    title: "Comedy Gold",
    description: "Weekly stand-up comedy, sketches, and hilarious conversations.",
    feedUrl: "https://example.com/comedygold.rss",
    author: "Laugh Factory",
    categories: ["Comedy", "Entertainment"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "trend-4",
    title: "Market Watch",
    description: "Daily financial news, stock analysis, and investing tips.",
    feedUrl: "https://example.com/marketwatch.rss",
    author: "Finance Daily",
    categories: ["Business", "News"],
    lastUpdated: new Date(),
    isSubscribed: true,
  },
  {
    id: "trend-5",
    title: "Science Weekly",
    description: "Breaking science news and in-depth analysis of the latest research.",
    feedUrl: "https://example.com/scienceweekly.rss",
    author: "Science Network",
    categories: ["Science", "Education"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "trend-6",
    title: "True Crime Files",
    description: "Investigative journalism into real criminal cases and unsolved mysteries.",
    feedUrl: "https://example.com/truecrime.rss",
    author: "Crime Network",
    categories: ["True Crime", "Documentary"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "trend-7",
    title: "Wellness Journey",
    description: "Tips for mental and physical health, meditation, and mindful living.",
    feedUrl: "https://example.com/wellness.rss",
    author: "Health Media",
    categories: ["Health", "Self-Help"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "trend-8",
    title: "Sports Talk Live",
    description: "Live commentary, analysis, and interviews from the world of sports.",
    feedUrl: "https://example.com/sportstalk.rss",
    author: "Sports Network",
    categories: ["Sports", "News"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "trend-9",
    title: "Creative Minds",
    description: "Interviews with artists, designers, and creative professionals.",
    feedUrl: "https://example.com/creativeminds.rss",
    author: "Arts Weekly",
    categories: ["Arts", "Culture"],
    lastUpdated: new Date(),
    isSubscribed: false,
  },
  {
    id: "trend-10",
    title: "Dev Talk",
    description: "Software development, programming tutorials, and tech career advice.",
    feedUrl: "https://example.com/devtalk.rss",
    author: "Code Academy",
    categories: ["Technology", "Education"],
    lastUpdated: new Date(),
    isSubscribed: true,
  },
]

/** Create discover store */
export function createDiscoverStore() {
  const [selectedCategory, setSelectedCategory] = createSignal<string>("all")
  const [isLoading, setIsLoading] = createSignal(false)
  const [podcasts, setPodcasts] = createSignal<Podcast[]>(TRENDING_PODCASTS)

  /** Get filtered podcasts by category */
  const filteredPodcasts = () => {
    const category = selectedCategory()
    if (category === "all") {
      return podcasts()
    }

    return podcasts().filter((p) => {
      const cats = p.categories?.map((c) => c.toLowerCase()) ?? []
      return cats.some((c) => c.includes(category.toLowerCase().replace("-", " ")))
    })
  }

  /** Subscribe to a podcast */
  const subscribe = (podcastId: string) => {
    setPodcasts((prev) =>
      prev.map((p) =>
        p.id === podcastId ? { ...p, isSubscribed: true } : p
      )
    )
  }

  /** Unsubscribe from a podcast */
  const unsubscribe = (podcastId: string) => {
    setPodcasts((prev) =>
      prev.map((p) =>
        p.id === podcastId ? { ...p, isSubscribed: false } : p
      )
    )
  }

  /** Toggle subscription */
  const toggleSubscription = (podcastId: string) => {
    const podcast = podcasts().find((p) => p.id === podcastId)
    if (podcast?.isSubscribed) {
      unsubscribe(podcastId)
    } else {
      subscribe(podcastId)
    }
  }

  /** Refresh trending podcasts (mock) */
  const refresh = async () => {
    setIsLoading(true)
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 500))
    // In real app, would fetch from API
    setIsLoading(false)
  }

  return {
    // State
    selectedCategory,
    isLoading,
    podcasts,
    filteredPodcasts,
    categories: DISCOVER_CATEGORIES,

    // Actions
    setSelectedCategory,
    subscribe,
    unsubscribe,
    toggleSubscription,
    refresh,
  }
}

/** Singleton discover store */
let discoverStoreInstance: ReturnType<typeof createDiscoverStore> | null = null

export function useDiscoverStore() {
  if (!discoverStoreInstance) {
    discoverStoreInstance = createDiscoverStore()
  }
  return discoverStoreInstance
}
