/**
 * Feed filter component for PodTUI
 * Toggle and filter options for feed list
 */

import { createSignal } from "solid-js";
import { FeedVisibility, FeedSortField } from "@/types/feed";
import type { FeedFilter } from "@/types/feed";

interface FeedFilterProps {
  filter: FeedFilter;
  focused?: boolean;
  onFilterChange: (filter: FeedFilter) => void;
}

type FilterField = "visibility" | "sort" | "pinned" | "search";

export function FeedFilterComponent(props: FeedFilterProps) {
  const [focusField, setFocusField] = createSignal<FilterField>("visibility");
  const [searchValue, setSearchValue] = createSignal(
    props.filter.searchQuery || "",
  );

  const fields: FilterField[] = ["visibility", "sort", "pinned", "search"];

  const handleKeyPress = (key: { name: string; shift?: boolean }) => {
    if (key.name === "tab") {
      const currentIndex = fields.indexOf(focusField());
      const nextIndex = key.shift
        ? (currentIndex - 1 + fields.length) % fields.length
        : (currentIndex + 1) % fields.length;
      setFocusField(fields[nextIndex]);
    } else if (key.name === "return") {
      if (focusField() === "visibility") {
        cycleVisibility();
      } else if (focusField() === "sort") {
        cycleSort();
      } else if (focusField() === "pinned") {
        togglePinned();
      }
    } else if (key.name === "space") {
      if (focusField() === "pinned") {
        togglePinned();
      }
    }
  };

  const cycleVisibility = () => {
    const current = props.filter.visibility;
    let next: FeedVisibility | "all";
    if (current === "all") next = FeedVisibility.PUBLIC;
    else if (current === FeedVisibility.PUBLIC) next = FeedVisibility.PRIVATE;
    else next = "all";
    props.onFilterChange({ ...props.filter, visibility: next });
  };

  const cycleSort = () => {
    const sortOptions: FeedSortField[] = [
      FeedSortField.UPDATED,
      FeedSortField.TITLE,
      FeedSortField.EPISODE_COUNT,
      FeedSortField.LATEST_EPISODE,
    ];
    const currentIndex = sortOptions.indexOf(
      props.filter.sortBy as FeedSortField,
    );
    const nextIndex = (currentIndex + 1) % sortOptions.length;
    props.onFilterChange({ ...props.filter, sortBy: sortOptions[nextIndex] });
  };

  const togglePinned = () => {
    props.onFilterChange({
      ...props.filter,
      pinnedOnly: !props.filter.pinnedOnly,
    });
  };

  const handleSearchInput = (value: string) => {
    setSearchValue(value);
    props.onFilterChange({ ...props.filter, searchQuery: value });
  };

  const visibilityLabel = () => {
    const vis = props.filter.visibility;
    if (vis === "all") return "All";
    if (vis === "public") return "Public";
    return "Private";
  };

  const visibilityColor = () => {
    const vis = props.filter.visibility;
    if (vis === "public") return "green";
    if (vis === "private") return "yellow";
    return "white";
  };

  const sortLabel = () => {
    const sort = props.filter.sortBy;
    switch (sort) {
      case "title":
        return "Title";
      case "episodeCount":
        return "Episodes";
      case "latestEpisode":
        return "Latest";
      case "updated":
      default:
        return "Updated";
    }
  };

  return (
    <box flexDirection="column" border padding={1} gap={1}>
      <text>
        <strong>Filter Feeds</strong>
      </text>

      <box flexDirection="row" gap={2} flexWrap="wrap">
        {/* Visibility filter */}
        <box
          border
          padding={0}
          backgroundColor={focusField() === "visibility" ? "#333" : undefined}
        >
          <box flexDirection="row" gap={1}>
            <text fg={focusField() === "visibility" ? "cyan" : "gray"}>
              Show:
            </text>
            <text fg={visibilityColor()}>{visibilityLabel()}</text>
          </box>
        </box>

        {/* Sort filter */}
        <box
          border
          padding={0}
          backgroundColor={focusField() === "sort" ? "#333" : undefined}
        >
          <box flexDirection="row" gap={1}>
            <text fg={focusField() === "sort" ? "cyan" : "gray"}>Sort:</text>
            <text fg="white">{sortLabel()}</text>
          </box>
        </box>

        {/* Pinned filter */}
        <box
          border
          padding={0}
          backgroundColor={focusField() === "pinned" ? "#333" : undefined}
        >
          <box flexDirection="row" gap={1}>
            <text fg={focusField() === "pinned" ? "cyan" : "gray"}>
              Pinned:
            </text>
            <text fg={props.filter.pinnedOnly ? "yellow" : "gray"}>
              {props.filter.pinnedOnly ? "Yes" : "No"}
            </text>
          </box>
        </box>
      </box>

      {/* Search box */}
      <box flexDirection="row" gap={1}>
        <text fg={focusField() === "search" ? "cyan" : "gray"}>Search:</text>
        <input
          value={searchValue()}
          onInput={handleSearchInput}
          placeholder="Filter by name..."
          focused={props.focused && focusField() === "search"}
          width={25}
        />
      </box>

      <text fg="gray">Tab to navigate, Enter/Space to toggle</text>
    </box>
  );
}
