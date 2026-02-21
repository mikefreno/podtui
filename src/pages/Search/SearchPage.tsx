/**
 * SearchPage component - Main search interface for PodTUI
 */

import { createSignal, createEffect, Show, onMount } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { useSearchStore } from "@/stores/search";
import { SearchResults } from "./SearchResults";
import { SearchHistory } from "./SearchHistory";
import type { SearchResult } from "@/types/source";
import { MyShowsPage } from "../MyShows/MyShowsPage";
import { useTheme } from "@/context/ThemeContext";
import { useNavigation } from "@/context/NavigationContext";

enum SearchPaneType {
  INPUT = 1,
  RESULTS = 2,
  HISTORY = 3,
}
export const SearchPaneCount = 3;

export function SearchPage() {
  const searchStore = useSearchStore();
  const [inputValue, setInputValue] = createSignal("");
  const [resultIndex, setResultIndex] = createSignal(0);
  const [historyIndex, setHistoryIndex] = createSignal(0);
  const { theme } = useTheme();
  const nav = useNavigation();

  onMount(() => {
    useKeyboard(
      (keyEvent: any) => {
        const isDown =
          keyEvent.key === "j" || keyEvent.key === "ArrowDown";
        const isUp =
          keyEvent.key === "k" || keyEvent.key === "ArrowUp";
        const isSelect =
          keyEvent.key === "Enter" || keyEvent.key === " ";

        if (isSelect) {
          const results = searchStore.results();
          if (results.length > 0 && resultIndex() < results.length) {
            setResultIndex(resultIndex() + 1);
          }
          return;
        }

        const results = searchStore.results();
        if (results.length === 0) return;

        if (isDown && resultIndex() < results.length - 1) {
          setResultIndex(resultIndex() + 1);
        } else if (isUp && resultIndex() > 0) {
          setResultIndex(resultIndex() - 1);
        }
      },
      { release: false },
    );
  });

  const handleSearch = async () => {
    const query = inputValue().trim();
    if (query) {
      await searchStore.search(query);
      if (searchStore.results().length > 0) {
        //setFocusArea("results"); //TODO: move level
        setResultIndex(0);
      }
    }
  };

  const handleHistorySelect = async (query: string) => {
    setInputValue(query);
    await searchStore.search(query);
    if (searchStore.results().length > 0) {
      //setFocusArea("results"); //TODO: move level
      setResultIndex(0);
    }
  };

  const handleResultSelect = (result: SearchResult) => {
    //props.onSubscribe?.(result);
    searchStore.markSubscribed(result.podcast.id);
  };

  return (
    <box flexDirection="column" height="100%" gap={1} width="100%">
      {/* Search Header */}
      <box flexDirection="column" gap={1}>
        <text fg={theme.text}>
          <strong>Search Podcasts</strong>
        </text>

        {/* Search Input */}
        <box flexDirection="row" gap={1} alignItems="center">
          <text fg="gray">Search:</text>
          <input
            value={inputValue()}
            onInput={(value) => {
              setInputValue(value);
            }}
            placeholder="Enter podcast name, topic, or author..."
            focused={nav.activeDepth() === SearchPaneType.INPUT}
            width={50}
          />
          <box
            border
            padding={0}
            paddingLeft={1}
            paddingRight={1}
            onMouseDown={handleSearch}
          >
            <text fg={theme.primary}>[Enter] Search</text>
          </box>
        </box>

        {/* Status */}
        <Show when={searchStore.isSearching()}>
          <text fg={theme.warning}>Searching...</text>
        </Show>
        <Show when={searchStore.error()}>
          <text fg={theme.error}>{searchStore.error()}</text>
        </Show>
      </box>

        {/* Main Content - Results or History */}
        <box flexDirection="row" height="100%" gap={2}>
          {/* Results Panel */}
          <box
            flexDirection="column"
            flexGrow={1}
            border
            borderColor={
              nav.activeDepth() === SearchPaneType.RESULTS
                ? theme.accent
                : theme.border
            }
          >
            <box padding={1}>
              <text
                fg={
                  nav.activeDepth() === SearchPaneType.RESULTS
                    ? theme.primary
                    : theme.muted
                }
              >
                Results ({searchStore.results().length})
              </text>
            </box>
            <Show
              when={searchStore.results().length > 0}
              fallback={
                <box padding={2}>
                  <text fg={theme.muted}>
                    {searchStore.query()
                      ? "No results found"
                      : "Enter a search term to find podcasts"}
                  </text>
                </box>
              }
            >
              <SearchResults
                results={searchStore.results()}
                selectedIndex={resultIndex()}
                focused={nav.activeDepth() === SearchPaneType.RESULTS}
                onSelect={handleResultSelect}
                onChange={setResultIndex}
                isSearching={searchStore.isSearching()}
                error={searchStore.error()}
              />
            </Show>
          </box>

          {/* History Sidebar */}
          <box width={30} border borderColor={theme.border}>
            <box padding={1} flexDirection="column">
              <box paddingBottom={1}>
                <text
                  fg={
                    nav.activeDepth() === SearchPaneType.HISTORY
                      ? theme.primary
                      : theme.muted
                  }
                >
                  History
                </text>
              </box>
              <SearchHistory
                history={searchStore.history()}
                selectedIndex={historyIndex()}
                focused={nav.activeDepth() === SearchPaneType.HISTORY}
                onSelect={handleHistorySelect}
                onRemove={searchStore.removeFromHistory}
                onClear={searchStore.clearHistory}
                onChange={setHistoryIndex}
              />
            </box>
          </box>
        </box>
    </box>
  );
}
