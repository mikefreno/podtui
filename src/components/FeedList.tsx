/**
 * Feed list component for PodTUI
 * Scrollable list of feeds with keyboard navigation and mouse support
 */

import { createSignal, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { FeedItem } from "./FeedItem"
import { useFeedStore } from "../stores/feed"
import { FeedVisibility, FeedSortField } from "../types/feed"
import type { Feed } from "../types/feed"

interface FeedListProps {
  focused?: boolean
  compact?: boolean
  showEpisodeCount?: boolean
  showLastUpdated?: boolean
  onSelectFeed?: (feed: Feed) => void
  onOpenFeed?: (feed: Feed) => void
}

export function FeedList(props: FeedListProps) {
  const feedStore = useFeedStore()
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  const filteredFeeds = () => feedStore.getFilteredFeeds()

  const handleKeyPress = (key: { name: string }) => {
    const feeds = filteredFeeds()

    if (key.name === "up" || key.name === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (key.name === "down" || key.name === "j") {
      setSelectedIndex((i) => Math.min(feeds.length - 1, i + 1))
    } else if (key.name === "return" || key.name === "enter") {
      const feed = feeds[selectedIndex()]
      if (feed && props.onOpenFeed) {
        props.onOpenFeed(feed)
      }
    } else if (key.name === "home" || key.name === "g") {
      setSelectedIndex(0)
    } else if (key.name === "end") {
      setSelectedIndex(feeds.length - 1)
    } else if (key.name === "pageup") {
      setSelectedIndex((i) => Math.max(0, i - 5))
    } else if (key.name === "pagedown") {
      setSelectedIndex((i) => Math.min(feeds.length - 1, i + 5))
    } else if (key.name === "p") {
      // Toggle pin on selected feed
      const feed = feeds[selectedIndex()]
      if (feed) {
        feedStore.togglePinned(feed.id)
      }
    } else if (key.name === "f") {
      // Cycle visibility filter
      cycleVisibilityFilter()
    } else if (key.name === "s") {
      // Cycle sort
      cycleSortField()
    }

    // Notify selection change
    const selectedFeed = feeds[selectedIndex()]
    if (selectedFeed && props.onSelectFeed) {
      props.onSelectFeed(selectedFeed)
    }
  }

  useKeyboard((key) => {
    if (!props.focused) return
    handleKeyPress(key)
  })

  const cycleVisibilityFilter = () => {
    const current = feedStore.filter().visibility
    let next: FeedVisibility | "all"
    if (current === "all") next = FeedVisibility.PUBLIC
    else if (current === FeedVisibility.PUBLIC) next = FeedVisibility.PRIVATE
    else next = "all"
    feedStore.setFilter({ ...feedStore.filter(), visibility: next })
  }

  const cycleSortField = () => {
    const sortOptions: FeedSortField[] = [
      FeedSortField.UPDATED,
      FeedSortField.TITLE,
      FeedSortField.EPISODE_COUNT,
      FeedSortField.LATEST_EPISODE,
    ]
    const current = feedStore.filter().sortBy as FeedSortField
    const idx = sortOptions.indexOf(current)
    const next = sortOptions[(idx + 1) % sortOptions.length]
    feedStore.setFilter({ ...feedStore.filter(), sortBy: next })
  }

  const visibilityLabel = () => {
    const vis = feedStore.filter().visibility
    if (vis === "all") return "All"
    if (vis === "public") return "Public"
    return "Private"
  }

  const sortLabel = () => {
    const sort = feedStore.filter().sortBy
    switch (sort) {
      case "title": return "Title"
      case "episodeCount": return "Episodes"
      case "latestEpisode": return "Latest"
      default: return "Updated"
    }
  }

  const handleFeedClick = (feed: Feed, index: number) => {
    setSelectedIndex(index)
    if (props.onSelectFeed) {
      props.onSelectFeed(feed)
    }
  }

  const handleFeedDoubleClick = (feed: Feed) => {
    if (props.onOpenFeed) {
      props.onOpenFeed(feed)
    }
  }

  return (
      <box flexDirection="column" gap={1}>
      {/* Header with filter controls */}
      <box flexDirection="row" justifyContent="space-between" paddingBottom={0}>
        <text>
          <strong>My Feeds</strong>
        </text>
        <text fg="gray">({filteredFeeds().length} feeds)</text>
        <box flexDirection="row" gap={1}>
          <box
            border
            padding={0}
            onMouseDown={cycleVisibilityFilter}
          >
            <text fg="cyan">[f] {visibilityLabel()}</text>
          </box>
          <box
            border
            padding={0}
            onMouseDown={cycleSortField}
          >
            <text fg="cyan">[s] {sortLabel()}</text>
          </box>
        </box>
      </box>

      {/* Feed list in scrollbox */}
      <Show
        when={filteredFeeds().length > 0}
        fallback={
          <box border padding={2}>
            <text fg="gray">
              No feeds found. Add podcasts from the Discover or Search tabs.
            </text>
          </box>
        }
      >
        <scrollbox height={15} focused={props.focused}>
          <For each={filteredFeeds()}>
            {(feed, index) => (
              <box onMouseDown={() => handleFeedClick(feed, index())}>
                <FeedItem
                  feed={feed}
                  isSelected={index() === selectedIndex()}
                  compact={props.compact}
                  showEpisodeCount={props.showEpisodeCount ?? true}
                  showLastUpdated={props.showLastUpdated ?? true}
                />
              </box>
            )}
          </For>
        </scrollbox>
      </Show>

      {/* Navigation help */}
      <box paddingTop={0}>
        <text fg="gray">
          j/k navigate | Enter open | p pin | f filter | s sort | Click to select
        </text>
      </box>
    </box>
  )
}
