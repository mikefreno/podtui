/**
 * DiscoverPage component - Main discover/browse interface for PodTUI
 */

import { createSignal } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useDiscoverStore, DISCOVER_CATEGORIES } from "../stores/discover"
import { CategoryFilter } from "./CategoryFilter"
import { TrendingShows } from "./TrendingShows"

type DiscoverPageProps = {
  focused: boolean
}

type FocusArea = "categories" | "shows"

export function DiscoverPage(props: DiscoverPageProps) {
  const discoverStore = useDiscoverStore()
  const [focusArea, setFocusArea] = createSignal<FocusArea>("shows")
  const [showIndex, setShowIndex] = createSignal(0)
  const [categoryIndex, setCategoryIndex] = createSignal(0)

  // Keyboard navigation
  useKeyboard((key) => {
    if (!props.focused) return

    const area = focusArea()

    // Tab switches focus between categories and shows
    if (key.name === "tab") {
      if (key.shift) {
        setFocusArea((a) => (a === "categories" ? "shows" : "categories"))
      } else {
        setFocusArea((a) => (a === "categories" ? "shows" : "categories"))
      }
      return
    }

    // Category navigation
    if (area === "categories") {
      if (key.name === "left" || key.name === "h") {
        const nextIndex = Math.max(0, categoryIndex() - 1)
        setCategoryIndex(nextIndex)
        const cat = DISCOVER_CATEGORIES[nextIndex]
        if (cat) discoverStore.setSelectedCategory(cat.id)
        setShowIndex(0)
        return
      }
      if (key.name === "right" || key.name === "l") {
        const nextIndex = Math.min(DISCOVER_CATEGORIES.length - 1, categoryIndex() + 1)
        setCategoryIndex(nextIndex)
        const cat = DISCOVER_CATEGORIES[nextIndex]
        if (cat) discoverStore.setSelectedCategory(cat.id)
        setShowIndex(0)
        return
      }
      if (key.name === "enter") {
        // Select category and move to shows
        setFocusArea("shows")
        return
      }
      if (key.name === "down" || key.name === "j") {
        setFocusArea("shows")
        return
      }
    }

    // Shows navigation
    if (area === "shows") {
      const shows = discoverStore.filteredPodcasts()
      if (key.name === "down" || key.name === "j") {
        if (shows.length === 0) return
        setShowIndex((i) => Math.min(i + 1, shows.length - 1))
        return
      }
      if (key.name === "up" || key.name === "k") {
        if (shows.length === 0) {
          setFocusArea("categories")
          return
        }
        const newIndex = showIndex() - 1
        if (newIndex < 0) {
          setFocusArea("categories")
        } else {
          setShowIndex(newIndex)
        }
        return
      }
      if (key.name === "enter") {
        // Subscribe/unsubscribe
        const podcast = shows[showIndex()]
        if (podcast) {
          discoverStore.toggleSubscription(podcast.id)
        }
        return
      }
    }

    // Refresh with 'r'
    if (key.name === "r") {
      discoverStore.refresh()
      return
    }
  })

  const handleCategorySelect = (categoryId: string) => {
    discoverStore.setSelectedCategory(categoryId)
    const index = DISCOVER_CATEGORIES.findIndex((c) => c.id === categoryId)
    if (index >= 0) setCategoryIndex(index)
    setShowIndex(0)
  }

  const handleShowSelect = (index: number) => {
    setShowIndex(index)
    setFocusArea("shows")
  }

  const handleSubscribe = (podcast: { id: string }) => {
    discoverStore.toggleSubscription(podcast.id)
  }

  return (
    <box flexDirection="column" height="100%" gap={1}>
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <text>
            <strong>Discover Podcasts</strong>
          </text>
        <box flexDirection="row" gap={2}>
          <text fg="gray">
            {discoverStore.filteredPodcasts().length} shows
          </text>
          <box onMouseDown={() => discoverStore.refresh()}>
            <text fg="cyan">[R] Refresh</text>
          </box>
        </box>
      </box>

      {/* Category Filter */}
      <box border padding={1}>
        <box flexDirection="column" gap={1}>
          <text fg={focusArea() === "categories" ? "cyan" : "gray"}>
            Categories:
          </text>
          <CategoryFilter
            categories={discoverStore.categories}
            selectedCategory={discoverStore.selectedCategory()}
            focused={focusArea() === "categories"}
            onSelect={handleCategorySelect}
          />
        </box>
      </box>

      {/* Trending Shows */}
      <box flexDirection="column" flexGrow={1} border>
          <box padding={1}>
            <text fg={focusArea() === "shows" ? "cyan" : "gray"}>
              Trending in {
                DISCOVER_CATEGORIES.find(
                  (c) => c.id === discoverStore.selectedCategory()
                )?.name ?? "All"
              }
            </text>
          </box>
        <TrendingShows
          podcasts={discoverStore.filteredPodcasts()}
          selectedIndex={showIndex()}
          focused={focusArea() === "shows"}
          isLoading={discoverStore.isLoading()}
          onSelect={handleShowSelect}
          onSubscribe={handleSubscribe}
        />
      </box>

      {/* Footer Hints */}
      <box flexDirection="row" gap={2}>
        <text fg="gray">[Tab] Switch focus</text>
        <text fg="gray">[j/k] Navigate</text>
        <text fg="gray">[Enter] Subscribe</text>
        <text fg="gray">[R] Refresh</text>
      </box>
    </box>
  )
}
