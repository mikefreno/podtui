/**
 * MyShowsPage - Two-panel file-explorer style view
 * Left panel: list of subscribed shows
 * Right panel: episodes for the selected show
 */

import { createSignal, For, Show, createMemo } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useFeedStore } from "../stores/feed"
import { format } from "date-fns"
import type { Episode } from "../types/episode"
import type { Feed } from "../types/feed"

type MyShowsPageProps = {
  focused: boolean
  onPlayEpisode?: (episode: Episode, feed: Feed) => void
  onExit?: () => void
}

type FocusPane = "shows" | "episodes"

export function MyShowsPage(props: MyShowsPageProps) {
  const feedStore = useFeedStore()
  const [focusPane, setFocusPane] = createSignal<FocusPane>("shows")
  const [showIndex, setShowIndex] = createSignal(0)
  const [episodeIndex, setEpisodeIndex] = createSignal(0)
  const [isRefreshing, setIsRefreshing] = createSignal(false)

  const shows = () => feedStore.getFilteredFeeds()

  const selectedShow = createMemo(() => {
    const s = shows()
    const idx = showIndex()
    return idx < s.length ? s[idx] : undefined
  })

  const episodes = createMemo(() => {
    const show = selectedShow()
    if (!show) return []
    return [...show.episodes].sort(
      (a, b) => b.pubDate.getTime() - a.pubDate.getTime()
    )
  })

  const formatDate = (date: Date): string => {
    return format(date, "MMM d, yyyy")
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const hrs = Math.floor(mins / 60)
    if (hrs > 0) return `${hrs}h ${mins % 60}m`
    return `${mins}m`
  }

  const handleRefresh = async () => {
    const show = selectedShow()
    if (!show) return
    setIsRefreshing(true)
    await feedStore.refreshFeed(show.id)
    setIsRefreshing(false)
  }

  const handleUnsubscribe = () => {
    const show = selectedShow()
    if (!show) return
    feedStore.removeFeed(show.id)
    setShowIndex((i) => Math.max(0, i - 1))
    setEpisodeIndex(0)
  }

  useKeyboard((key) => {
    if (!props.focused) return

    const pane = focusPane()

    // Navigate between panes
    if (key.name === "right" || key.name === "l") {
      if (pane === "shows" && selectedShow()) {
        setFocusPane("episodes")
        setEpisodeIndex(0)
      }
      return
    }
    if (key.name === "left" || key.name === "h") {
      if (pane === "episodes") {
        setFocusPane("shows")
      }
      return
    }
    if (key.name === "tab") {
      if (pane === "shows" && selectedShow()) {
        setFocusPane("episodes")
        setEpisodeIndex(0)
      } else {
        setFocusPane("shows")
      }
      return
    }

    if (pane === "shows") {
      const s = shows()
      if (key.name === "down" || key.name === "j") {
        setShowIndex((i) => Math.min(s.length - 1, i + 1))
        setEpisodeIndex(0)
      } else if (key.name === "up" || key.name === "k") {
        setShowIndex((i) => Math.max(0, i - 1))
        setEpisodeIndex(0)
      } else if (key.name === "return" || key.name === "enter") {
        if (selectedShow()) {
          setFocusPane("episodes")
          setEpisodeIndex(0)
        }
      } else if (key.name === "d") {
        handleUnsubscribe()
      } else if (key.name === "r") {
        handleRefresh()
      } else if (key.name === "escape") {
        props.onExit?.()
      }
    } else if (pane === "episodes") {
      const eps = episodes()
      if (key.name === "down" || key.name === "j") {
        setEpisodeIndex((i) => Math.min(eps.length - 1, i + 1))
      } else if (key.name === "up" || key.name === "k") {
        setEpisodeIndex((i) => Math.max(0, i - 1))
      } else if (key.name === "return" || key.name === "enter") {
        const ep = eps[episodeIndex()]
        const show = selectedShow()
        if (ep && show) props.onPlayEpisode?.(ep, show)
      } else if (key.name === "pageup") {
        setEpisodeIndex((i) => Math.max(0, i - 10))
      } else if (key.name === "pagedown") {
        setEpisodeIndex((i) => Math.min(eps.length - 1, i + 10))
      } else if (key.name === "r") {
        handleRefresh()
      } else if (key.name === "escape") {
        setFocusPane("shows")
      }
    }
  })

  return {
    showsPanel: () => (
      <box flexDirection="column" height="100%">
        <Show when={isRefreshing()}>
          <text fg="yellow">Refreshing...</text>
        </Show>
        <Show
          when={shows().length > 0}
          fallback={
            <box padding={1}>
              <text fg="gray">
                No shows yet. Subscribe from Discover or Search.
              </text>
            </box>
          }
        >
          <scrollbox height="100%" focused={props.focused && focusPane() === "shows"}>
            <For each={shows()}>
              {(feed, index) => (
                <box
                  flexDirection="row"
                  gap={1}
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={index() === showIndex() ? "#333" : undefined}
                  onMouseDown={() => {
                    setShowIndex(index())
                    setEpisodeIndex(0)
                  }}
                >
                  <text fg={index() === showIndex() ? "cyan" : "gray"}>
                    {index() === showIndex() ? ">" : " "}
                  </text>
                  <text fg={index() === showIndex() ? "white" : undefined}>
                    {feed.customName || feed.podcast.title}
                  </text>
                  <text fg="gray">({feed.episodes.length})</text>
                </box>
              )}
            </For>
          </scrollbox>
        </Show>
      </box>
    ),

    episodesPanel: () => (
      <box flexDirection="column" height="100%">
        <Show
          when={selectedShow()}
          fallback={
            <box padding={1}>
              <text fg="gray">Select a show</text>
            </box>
          }
        >
          <Show
            when={episodes().length > 0}
            fallback={
              <box padding={1}>
                <text fg="gray">No episodes. Press [r] to refresh.</text>
              </box>
            }
          >
            <scrollbox height="100%" focused={props.focused && focusPane() === "episodes"}>
              <For each={episodes()}>
                {(episode, index) => (
                  <box
                    flexDirection="column"
                    gap={0}
                    paddingLeft={1}
                    paddingRight={1}
                    backgroundColor={index() === episodeIndex() ? "#333" : undefined}
                    onMouseDown={() => setEpisodeIndex(index())}
                  >
                    <box flexDirection="row" gap={1}>
                      <text fg={index() === episodeIndex() ? "cyan" : "gray"}>
                        {index() === episodeIndex() ? ">" : " "}
                      </text>
                      <text fg={index() === episodeIndex() ? "white" : undefined}>
                        {episode.episodeNumber ? `#${episode.episodeNumber} ` : ""}
                        {episode.title}
                      </text>
                    </box>
                    <box flexDirection="row" gap={2} paddingLeft={2}>
                      <text fg="gray">{formatDate(episode.pubDate)}</text>
                      <text fg="gray">{formatDuration(episode.duration)}</text>
                    </box>
                  </box>
                )}
              </For>
            </scrollbox>
          </Show>
        </Show>
      </box>
    ),

    focusPane,
    selectedShow,
  }
}
