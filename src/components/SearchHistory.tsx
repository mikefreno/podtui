/**
 * SearchHistory component for displaying and managing search history
 */

import { For, Show } from "solid-js"

type SearchHistoryProps = {
  history: string[]
  focused: boolean
  selectedIndex: number
  onSelect?: (query: string) => void
  onRemove?: (query: string) => void
  onClear?: () => void
  onChange?: (index: number) => void
}

export function SearchHistory(props: SearchHistoryProps) {
  const handleSearchClick = (index: number, query: string) => {
    props.onChange?.(index)
    props.onSelect?.(query)
  }

  const handleRemoveClick = (query: string) => {
    props.onRemove?.(query)
  }

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg="gray">Recent Searches</text>
        <Show when={props.history.length > 0}>
          <box onMouseDown={() => props.onClear?.()} padding={0}>
            <text fg="red">[Clear All]</text>
          </box>
        </Show>
      </box>

      <Show
        when={props.history.length > 0}
        fallback={
          <box padding={1}>
            <text fg="gray">No recent searches</text>
          </box>
        }
      >
        <scrollbox height={10}>
          <box flexDirection="column">
            <For each={props.history}>
              {(query, index) => {
                const isSelected = () => index() === props.selectedIndex && props.focused

                return (
                  <box
                    flexDirection="row"
                    justifyContent="space-between"
                    padding={0}
                    paddingLeft={1}
                    paddingRight={1}
                    backgroundColor={isSelected() ? "#333" : undefined}
                    onMouseDown={() => handleSearchClick(index(), query)}
                  >
                    <box flexDirection="row" gap={1}>
                      <text fg="gray">{">"}</text>
                      <text fg={isSelected() ? "cyan" : "white"}>{query}</text>
                    </box>
                    <box onMouseDown={() => handleRemoveClick(query)} padding={0}>
                      <text fg="red">[x]</text>
                    </box>
                  </box>
                )
              }}
            </For>
          </box>
        </scrollbox>
      </Show>
    </box>
  )
}
