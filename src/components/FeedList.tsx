/**
 * Feed list component for PodTUI
 * Scrollable list of feeds with keyboard navigation
 */

import { createSignal, For, Show } from "solid-js"
import { FeedItem } from "./FeedItem"
import type { Feed, FeedFilter, FeedVisibility, FeedSortField } from "../types/feed"
import { format } from "date-fns"

interface FeedListProps {
  feeds: Feed[]
  focused?: boolean
  compact?: boolean
  showEpisodeCount?: boolean
  showLastUpdated?: boolean
  onSelectFeed?: (feed: Feed) => void
  onOpenFeed?: (feed: Feed) => void
}

export function FeedList(props: FeedListProps) {
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [filter, setFilter] = createSignal<FeedFilter>({
    visibility: "all",
    sortBy: "updated" as FeedSortField,
    sortDirection: "desc",
  })

  /** Get filtered and sorted feeds */
  const filteredFeeds = (): Feed[] => {
    let result = [...props.feeds]

    // Filter by visibility
    const vis = filter().visibility
    if (vis && vis !== "all") {
      result = result.filter((f) => f.visibility === vis)
    }

    // Filter by pinned only
    if (filter().pinnedOnly) {
      result = result.filter((f) => f.isPinned)
    }

    // Filter by search query
    const query = filter().searchQuery?.toLowerCase()
    if (query) {
      result = result.filter(
        (f) =>
          f.podcast.title.toLowerCase().includes(query) ||
          f.customName?.toLowerCase().includes(query) ||
          f.podcast.description?.toLowerCase().includes(query)
      )
    }

    // Sort feeds
    const sortField = filter().sortBy
    const sortDir = filter().sortDirection === "asc" ? 1 : -1

    result.sort((a, b) => {
      switch (sortField) {
        case "title":
          return (
            sortDir *
            (a.customName || a.podcast.title).localeCompare(
              b.customName || b.podcast.title
            )
          )
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
    } else if (key.name === "home") {
      setSelectedIndex(0)
    } else if (key.name === "end") {
      setSelectedIndex(feeds.length - 1)
    } else if (key.name === "pageup") {
      setSelectedIndex((i) => Math.max(0, i - 5))
    } else if (key.name === "pagedown") {
      setSelectedIndex((i) => Math.min(feeds.length - 1, i + 5))
    }

    // Notify selection change
    const selectedFeed = feeds[selectedIndex()]
    if (selectedFeed && props.onSelectFeed) {
      props.onSelectFeed(selectedFeed)
    }
  }

  const toggleVisibilityFilter = () => {
    setFilter((f) => {
      const current = f.visibility
      let next: FeedVisibility | "all"
      if (current === "all") next = "public"
      else if (current === "public") next = "private"
      else next = "all"
      return { ...f, visibility: next }
    })
  }

  const visibilityLabel = () => {
    const vis = filter().visibility
    if (vis === "all") return "All"
    if (vis === "public") return "Public"
    return "Private"
  }

  return (
    <box
      flexDirection="column"
      gap={1}
      onKeyPress={props.focused ? handleKeyPress : undefined}
    >
      {/* Header with filter */}
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text>
          <strong>My Feeds</strong>
          <span fg="gray"> ({filteredFeeds().length} feeds)</span>
        </text>
        <box flexDirection="row" gap={2}>
          <box border padding={0} onMouseDown={toggleVisibilityFilter}>
            <text>
              <span fg="cyan">[F] {visibilityLabel()}</span>
            </text>
          </box>
        </box>
      </box>

      {/* Feed list in scrollbox */}
      <Show
        when={filteredFeeds().length > 0}
        fallback={
          <box border padding={2}>
            <text>
              <span fg="gray">
                No feeds found. Add podcasts from the Discover or Search tabs.
              </span>
            </text>
          </box>
        }
      >
        <scrollbox
          height={15}
          focused={props.focused}
          selectedIndex={selectedIndex()}
        >
          <For each={filteredFeeds()}>
            {(feed, index) => (
              <FeedItem
                feed={feed}
                isSelected={index() === selectedIndex()}
                compact={props.compact}
                showEpisodeCount={props.showEpisodeCount ?? true}
                showLastUpdated={props.showLastUpdated ?? true}
              />
            )}
          </For>
        </scrollbox>
      </Show>

      {/* Navigation help */}
      <box paddingTop={1}>
        <text>
          <span fg="gray">
            j/k or arrows to navigate, Enter to open, F to filter
          </span>
        </text>
      </box>
    </box>
  )
}
