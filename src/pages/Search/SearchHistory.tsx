/**
 * SearchHistory component for displaying and managing search history
 */

import { For, Show } from "solid-js"
import { useTheme } from "@/context/ThemeContext"
import { SelectableBox, SelectableText } from "@/components/Selectable"

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
  const { theme } = useTheme();
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
            <text fg={theme.textMuted}>Recent Searches</text>
            <Show when={props.history.length > 0}>
              <box onMouseDown={() => props.onClear?.()} padding={0}>
                <text fg={theme.error}>[Clear All]</text>
              </box>
            </Show>
      </box>

      <Show
        when={props.history.length > 0}
        fallback={
          <box padding={1}>
            <text fg={theme.textMuted}>No recent searches</text>
          </box>
        }
      >
        <scrollbox height={10}>
          <box flexDirection="column">
            <For each={props.history}>
              {(query, index) => {
                const isSelected = () => index() === props.selectedIndex && props.focused

                return (
                  <SelectableBox
                    selected={isSelected}
                    flexDirection="row"
                    justifyContent="space-between"
                    padding={0}
                    paddingLeft={1}
                    paddingRight={1}
                    onMouseDown={() => handleSearchClick(index(), query)}
                  >
                    <SelectableText
                      selected={isSelected}
                      fg={theme.textMuted}
                    >
                      {">"}
                    </SelectableText>
                    <SelectableText
                      selected={isSelected}
                      fg={theme.primary}
                    >
                      {query}
                    </SelectableText>
                    <box onMouseDown={() => handleRemoveClick(query)} padding={0}>
                      <text fg={theme.error}>[x]</text>
                    </box>
                  </SelectableBox>
                )
              }}
            </For>
          </box>
        </scrollbox>
      </Show>
    </box>
  )
}
