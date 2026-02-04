/**
 * SearchResults component for displaying podcast search results
 */

import { For, Show } from "solid-js"
import type { SearchResult } from "../types/source"
import { ResultCard } from "./ResultCard"
import { ResultDetail } from "./ResultDetail"

type SearchResultsProps = {
  results: SearchResult[]
  selectedIndex: number
  focused: boolean
  onSelect?: (result: SearchResult) => void
  onChange?: (index: number) => void
  isSearching?: boolean
  error?: string | null
}

export function SearchResults(props: SearchResultsProps) {
  const handleSelect = (index: number) => {
    props.onChange?.(index)
  }

  return (
    <Show when={!props.isSearching} fallback={
      <box padding={1}>
        <text fg="yellow">Searching...</text>
      </box>
    }>
      <Show
        when={!props.error}
        fallback={
          <box padding={1}>
            <text fg="red">{props.error}</text>
          </box>
        }
      >
        <Show
          when={props.results.length > 0}
          fallback={
            <box padding={1}>
              <text fg="gray">No results found. Try a different search term.</text>
            </box>
          }
        >
          <box flexDirection="row" gap={1} height="100%">
            <box flexDirection="column" flexGrow={1}>
              <scrollbox height="100%">
                <box flexDirection="column" gap={1}>
                  <For each={props.results}>
                    {(result, index) => (
                      <ResultCard
                        result={result}
                        selected={index() === props.selectedIndex}
                        onSelect={() => handleSelect(index())}
                        onSubscribe={() => props.onSelect?.(result)}
                      />
                    )}
                  </For>
                </box>
              </scrollbox>
            </box>
            <box width={36}>
              <ResultDetail
                result={props.results[props.selectedIndex]}
                onSubscribe={(result) => props.onSelect?.(result)}
              />
            </box>
          </box>
        </Show>
      </Show>
    </Show>
  )
}
