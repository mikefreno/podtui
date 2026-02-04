/**
 * Source management component for PodTUI
 * Add, remove, and configure podcast sources
 */

import { createSignal, For } from "solid-js"
import { useFeedStore } from "../stores/feed"
import type { PodcastSource, SourceType } from "../types/source"

interface SourceManagerProps {
  focused?: boolean
  onClose?: () => void
}

type FocusArea = "list" | "add" | "url"

export function SourceManager(props: SourceManagerProps) {
  const feedStore = useFeedStore()
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [focusArea, setFocusArea] = createSignal<FocusArea>("list")
  const [newSourceUrl, setNewSourceUrl] = createSignal("")
  const [newSourceName, setNewSourceName] = createSignal("")
  const [error, setError] = createSignal<string | null>(null)

  const sources = () => feedStore.sources()

  const handleKeyPress = (key: { name: string; shift?: boolean }) => {
    if (key.name === "escape") {
      if (focusArea() !== "list") {
        setFocusArea("list")
        setError(null)
      } else if (props.onClose) {
        props.onClose()
      }
      return
    }

    if (key.name === "tab") {
      const areas: FocusArea[] = ["list", "add", "url"]
      const idx = areas.indexOf(focusArea())
      const nextIdx = key.shift
        ? (idx - 1 + areas.length) % areas.length
        : (idx + 1) % areas.length
      setFocusArea(areas[nextIdx])
      return
    }

    if (focusArea() === "list") {
      if (key.name === "up" || key.name === "k") {
        setSelectedIndex((i) => Math.max(0, i - 1))
      } else if (key.name === "down" || key.name === "j") {
        setSelectedIndex((i) => Math.min(sources().length - 1, i + 1))
      } else if (key.name === "return" || key.name === "enter" || key.name === "space") {
        const source = sources()[selectedIndex()]
        if (source) {
          feedStore.toggleSource(source.id)
        }
      } else if (key.name === "d" || key.name === "delete") {
        const source = sources()[selectedIndex()]
        if (source) {
          const removed = feedStore.removeSource(source.id)
          if (!removed) {
            setError("Cannot remove default sources")
          }
        }
      } else if (key.name === "a") {
        setFocusArea("add")
      }
    }
  }

  const handleAddSource = () => {
    const url = newSourceUrl().trim()
    const name = newSourceName().trim() || `Custom Source`

    if (!url) {
      setError("URL is required")
      return
    }

    try {
      new URL(url)
    } catch {
      setError("Invalid URL format")
      return
    }

    feedStore.addSource({
      name,
      type: "rss" as SourceType,
      baseUrl: url,
      enabled: true,
      description: `Custom RSS feed: ${url}`,
    })

    setNewSourceUrl("")
    setNewSourceName("")
    setFocusArea("list")
    setError(null)
  }

  const getSourceIcon = (source: PodcastSource) => {
    if (source.type === "api") return "[API]"
    if (source.type === "rss") return "[RSS]"
    return "[?]"
  }

  return (
    <box
      flexDirection="column"
      border
      padding={1}
      gap={1}
      onKeyPress={props.focused ? handleKeyPress : undefined}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <strong>Podcast Sources</strong>
        </text>
        <box border padding={0} onMouseDown={props.onClose}>
          <text>
            <span fg="cyan">[Esc] Close</span>
          </text>
        </box>
      </box>

      <text>
        <span fg="gray">
          Manage where to search for podcasts
        </span>
      </text>

      {/* Source list */}
      <box border padding={1} flexDirection="column">
        <text>
          <span fg={focusArea() === "list" ? "cyan" : "gray"}>Sources:</span>
        </text>
        <scrollbox height={6}>
          <For each={sources()}>
            {(source, index) => (
              <box
                flexDirection="row"
                gap={1}
                padding={0}
                backgroundColor={
                  focusArea() === "list" && index() === selectedIndex()
                    ? "#333"
                    : undefined
                }
                onMouseDown={() => {
                  setSelectedIndex(index())
                  setFocusArea("list")
                  feedStore.toggleSource(source.id)
                }}
              >
                <text>
                  <span
                    fg={
                      focusArea() === "list" && index() === selectedIndex()
                        ? "cyan"
                        : "gray"
                    }
                  >
                    {focusArea() === "list" && index() === selectedIndex()
                      ? ">"
                      : " "}
                  </span>
                </text>
                <text>
                  <span fg={source.enabled ? "green" : "red"}>
                    {source.enabled ? "[x]" : "[ ]"}
                  </span>
                </text>
                <text>
                  <span fg="yellow">{getSourceIcon(source)}</span>
                </text>
                <text>
                  <span
                    fg={
                      focusArea() === "list" && index() === selectedIndex()
                        ? "white"
                        : undefined
                    }
                  >
                    {source.name}
                  </span>
                </text>
              </box>
            )}
          </For>
        </scrollbox>
        <text>
          <span fg="gray">
            Space/Enter to toggle, d to delete, a to add
          </span>
        </text>
      </box>

      {/* Add new source form */}
      <box border padding={1} flexDirection="column" gap={1}>
        <text>
          <span fg={focusArea() === "add" || focusArea() === "url" ? "cyan" : "gray"}>
            Add New Source:
          </span>
        </text>
        
        <box flexDirection="row" gap={1}>
          <text>
            <span fg="gray">Name:</span>
          </text>
          <input
            value={newSourceName()}
            onInput={setNewSourceName}
            placeholder="My Custom Feed"
            focused={props.focused && focusArea() === "add"}
            width={25}
          />
        </box>

        <box flexDirection="row" gap={1}>
          <text>
            <span fg="gray">URL:</span>
          </text>
          <input
            value={newSourceUrl()}
            onInput={(v) => {
              setNewSourceUrl(v)
              setError(null)
            }}
            placeholder="https://example.com/feed.rss"
            focused={props.focused && focusArea() === "url"}
            width={35}
          />
        </box>

        <box
          border
          padding={0}
          width={15}
          onMouseDown={handleAddSource}
        >
          <text>
            <span fg="green">[+] Add Source</span>
          </text>
        </box>
      </box>

      {/* Error message */}
      {error() && (
        <text>
          <span fg="red">{error()}</span>
        </text>
      )}

      <text>
        <span fg="gray">Tab to switch sections, Esc to close</span>
      </text>
    </box>
  )
}
