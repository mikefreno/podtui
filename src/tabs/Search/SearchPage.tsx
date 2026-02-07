/**
 * SearchPage component - Main search interface for PodTUI
 */

import { createSignal, createEffect, Show } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { useSearchStore } from "@/stores/search";
import { SearchResults } from "./SearchResults";
import { SearchHistory } from "./SearchHistory";
import type { SearchResult } from "@/types/source";

type SearchPageProps = {
  focused: boolean;
  onSubscribe?: (result: SearchResult) => void;
  onInputFocusChange?: (focused: boolean) => void;
  onExit?: () => void;
};

type FocusArea = "input" | "results" | "history";

export function SearchPage(props: SearchPageProps) {
  const searchStore = useSearchStore();
  const [focusArea, setFocusArea] = createSignal<FocusArea>("input");
  const [inputValue, setInputValue] = createSignal("");
  const [resultIndex, setResultIndex] = createSignal(0);
  const [historyIndex, setHistoryIndex] = createSignal(0);

  // Keep parent informed about input focus state
  createEffect(() => {
    const isInputFocused = props.focused && focusArea() === "input";
    props.onInputFocusChange?.(isInputFocused);
  });

  const handleSearch = async () => {
    const query = inputValue().trim();
    if (query) {
      await searchStore.search(query);
      if (searchStore.results().length > 0) {
        setFocusArea("results");
        setResultIndex(0);
      }
    }
  };

  const handleHistorySelect = async (query: string) => {
    setInputValue(query);
    await searchStore.search(query);
    if (searchStore.results().length > 0) {
      setFocusArea("results");
      setResultIndex(0);
    }
  };

  const handleResultSelect = (result: SearchResult) => {
    props.onSubscribe?.(result);
    searchStore.markSubscribed(result.podcast.id);
  };

  // Keyboard navigation
  useKeyboard((key) => {
    if (!props.focused) return;

    const area = focusArea();

    // Enter to search from input
    if (key.name === "return" && area === "input") {
      handleSearch();
      return;
    }

    // Tab to cycle focus areas
    if (key.name === "tab" && !key.shift) {
      if (area === "input") {
        if (searchStore.results().length > 0) {
          setFocusArea("results");
        } else if (searchStore.history().length > 0) {
          setFocusArea("history");
        }
      } else if (area === "results") {
        if (searchStore.history().length > 0) {
          setFocusArea("history");
        } else {
          setFocusArea("input");
        }
      } else {
        setFocusArea("input");
      }
      return;
    }

    if (key.name === "tab" && key.shift) {
      if (area === "input") {
        if (searchStore.history().length > 0) {
          setFocusArea("history");
        } else if (searchStore.results().length > 0) {
          setFocusArea("results");
        }
      } else if (area === "history") {
        if (searchStore.results().length > 0) {
          setFocusArea("results");
        } else {
          setFocusArea("input");
        }
      } else {
        setFocusArea("input");
      }
      return;
    }

    // Up/Down for results and history
    if (area === "results") {
      const results = searchStore.results();
      if (key.name === "down" || key.name === "j") {
        setResultIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (key.name === "up" || key.name === "k") {
        setResultIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        const result = results[resultIndex()];
        if (result) handleResultSelect(result);
        return;
      }
    }

    if (area === "history") {
      const history = searchStore.history();
      if (key.name === "down" || key.name === "j") {
        setHistoryIndex((i) => Math.min(i + 1, history.length - 1));
        return;
      }
      if (key.name === "up" || key.name === "k") {
        setHistoryIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        const query = history[historyIndex()];
        if (query) handleHistorySelect(query);
        return;
      }
    }

    // Escape goes back to input or up one level
    if (key.name === "escape") {
      if (area === "input") {
        props.onExit?.();
      } else {
        setFocusArea("input");
        key.stopPropagation();
      }
      return;
    }

    // "/" focuses search input
    if (key.name === "/" && area !== "input") {
      setFocusArea("input");
      return;
    }
  });

  return (
    <box flexDirection="column" height="100%" gap={1}>
      {/* Search Header */}
      <box flexDirection="column" gap={1}>
        <text>
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
            focused={props.focused && focusArea() === "input"}
            width={50}
          />
          <box
            border
            padding={0}
            paddingLeft={1}
            paddingRight={1}
            onMouseDown={handleSearch}
          >
            <text fg="cyan">[Enter] Search</text>
          </box>
        </box>

        {/* Status */}
        <Show when={searchStore.isSearching()}>
          <text fg="yellow">Searching...</text>
        </Show>
        <Show when={searchStore.error()}>
          <text fg="red">{searchStore.error()}</text>
        </Show>
      </box>

      {/* Main Content - Results or History */}
      <box flexDirection="row" height="100%" gap={2}>
        {/* Results Panel */}
        <box flexDirection="column" flexGrow={1} border>
          <box padding={1}>
            <text fg={focusArea() === "results" ? "cyan" : "gray"}>
              Results ({searchStore.results().length})
            </text>
          </box>
          <Show
            when={searchStore.results().length > 0}
            fallback={
              <box padding={2}>
                <text fg="gray">
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
              focused={focusArea() === "results"}
              onSelect={handleResultSelect}
              onChange={setResultIndex}
              isSearching={searchStore.isSearching()}
              error={searchStore.error()}
            />
          </Show>
        </box>

        {/* History Sidebar */}
        <box width={30} border>
          <box padding={1} flexDirection="column">
            <box paddingBottom={1}>
              <text fg={focusArea() === "history" ? "cyan" : "gray"}>
                History
              </text>
            </box>
            <SearchHistory
              history={searchStore.history()}
              selectedIndex={historyIndex()}
              focused={focusArea() === "history"}
              onSelect={handleHistorySelect}
              onRemove={searchStore.removeFromHistory}
              onClear={searchStore.clearHistory}
              onChange={setHistoryIndex}
            />
          </box>
        </box>
      </box>

      {/* Footer Hints */}
      <box flexDirection="row" gap={2}>
        <text fg="gray">[Tab] Switch focus</text>
        <text fg="gray">[/] Focus search</text>
        <text fg="gray">[Enter] Select</text>
        <text fg="gray">[Esc] Up</text>
      </box>
    </box>
  );
}
