/**
 * SearchResults component for displaying podcast search results
 */

import { For, Show } from "solid-js"
import type { SearchResult } from "../types/source"

type SearchResultsProps = {
  results: SearchResult[]
  selectedIndex: number
  focused: boolean
  onSelect?: (result: SearchResult) => void
  onChange?: (index: number) => void
}

export function SearchResults(props: SearchResultsProps) {
  const handleMouseDown = (index: number, result: SearchResult) => {
    props.onChange?.(index)
    props.onSelect?.(result)
  }

  return (
    <Show
      when={props.results.length > 0}
      fallback={
        <box padding={1}>
          <text>
            <span fg="gray">No results found. Try a different search term.</span>
          </text>
        </box>
      }
    >
      <scrollbox height="100%" showScrollIndicator>
        <box flexDirection="column">
          <For each={props.results}>
            {(result, index) => {
              const isSelected = () => index() === props.selectedIndex
              const podcast = result.podcast

              return (
                <box
                  flexDirection="column"
                  padding={1}
                  backgroundColor={isSelected() ? "#333" : undefined}
                  onMouseDown={() => handleMouseDown(index(), result)}
                >
                  <box flexDirection="row" gap={2}>
                    <text>
                      <span fg={isSelected() ? "cyan" : "white"}>
                        <strong>{podcast.title}</strong>
                      </span>
                    </text>
                    <Show when={podcast.isSubscribed}>
                      <text>
                        <span fg="green">[Subscribed]</span>
                      </text>
                    </Show>
                    <text>
                      <span fg="gray">({result.sourceId})</span>
                    </text>
                  </box>

                  <Show when={podcast.author}>
                    <text>
                      <span fg="gray">by {podcast.author}</span>
                    </text>
                  </Show>

                  <Show when={podcast.description}>
                    <text>
                      <span fg={isSelected() ? "white" : "gray"}>
                        {podcast.description!.length > 100
                          ? podcast.description!.slice(0, 100) + "..."
                          : podcast.description}
                      </span>
                    </text>
                  </Show>

                  <Show when={podcast.categories && podcast.categories.length > 0}>
                    <box flexDirection="row" gap={1}>
                      <For each={podcast.categories!.slice(0, 3)}>
                        {(category) => (
                          <text>
                            <span fg="yellow">[{category}]</span>
                          </text>
                        )}
                      </For>
                    </box>
                  </Show>
                </box>
              )
            }}
          </For>
        </box>
      </scrollbox>
    </Show>
  )
}
