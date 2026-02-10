/**
 * DiscoverPage component - Main discover/browse interface for PodTUI
 */

import { createSignal, For, Show } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { useDiscoverStore, DISCOVER_CATEGORIES } from "@/stores/discover";
import { useTheme } from "@/context/ThemeContext";
import { PodcastCard } from "./PodcastCard";
import { PageProps } from "@/App";

enum DiscoverPagePaneType {
  CATEGORIES = 1,
  SHOWS = 2,
}
export const DiscoverPaneCount = 2;

export function DiscoverPage(props: PageProps) {
  const discoverStore = useDiscoverStore();
  const [showIndex, setShowIndex] = createSignal(0);
  const [categoryIndex, setCategoryIndex] = createSignal(0);

  const handleCategorySelect = (categoryId: string) => {
    discoverStore.setSelectedCategory(categoryId);
    const index = DISCOVER_CATEGORIES.findIndex((c) => c.id === categoryId);
    if (index >= 0) setCategoryIndex(index);
    setShowIndex(0);
  };

  const handleShowSelect = (index: number) => {
    setShowIndex(index);
  };

  const handleSubscribe = (podcast: { id: string }) => {
    discoverStore.toggleSubscription(podcast.id);
  };

  const { theme } = useTheme();
  return (
    <box flexDirection="row" flexGrow={1} height="100%" width="100%" gap={1}>
      <box
        border
        padding={1}
        borderColor={theme.border}
        flexDirection="column"
        gap={1}
      >
        <text
          fg={
            props.depth() == DiscoverPagePaneType.CATEGORIES
              ? theme.accent
              : theme.text
          }
        >
          Categories:
        </text>
        <box flexDirection="column" gap={1}>
          <For each={discoverStore.categories}>
            {(category) => {
              const isSelected = () =>
                discoverStore.selectedCategory() === category.id;

              return (
                <box
                  border={isSelected()}
                  backgroundColor={isSelected() ? theme.accent : undefined}
                  onMouseDown={() => handleCategorySelect(category.id)}
                >
                  <text fg={isSelected() ? theme.primary : theme.textMuted}>
                    {category.icon} {category.name}
                  </text>
                </box>
              );
            }}
          </For>
        </box>
      </box>
      <box
        flexDirection="column"
        flexGrow={1}
        border
        borderColor={theme.border}
      >
        <box padding={1}>
          <text
            fg={props.depth() == DiscoverPagePaneType.SHOWS ? theme.primary : theme.textMuted}
          >
            Trending in{" "}
            {DISCOVER_CATEGORIES.find(
              (c) => c.id === discoverStore.selectedCategory(),
            )?.name ?? "All"}
          </text>
        </box>
        <box flexDirection="column" height="100%">
          <Show
            fallback={
              <box padding={2}>
                {discoverStore.filteredPodcasts().length !== 0 ? (
                  <text fg={theme.warning}>Loading trending shows...</text>
                ) : (
                  <text fg={theme.textMuted}>No podcasts found in this category.</text>
                )}
              </box>
            }
            when={
              !discoverStore.isLoading() &&
              discoverStore.filteredPodcasts().length === 0
            }
          >
            <scrollbox>
              <box flexDirection="column">
                <For each={discoverStore.filteredPodcasts()}>
                  {(podcast, index) => (
                    <PodcastCard
                      podcast={podcast}
                      selected={
                        index() === showIndex() &&
                        props.depth() == DiscoverPagePaneType.SHOWS
                      }
                      onSelect={() => handleShowSelect(index())}
                      onSubscribe={() => handleSubscribe(podcast)}
                    />
                  )}
                </For>
              </box>
            </scrollbox>
          </Show>
        </box>
      </box>
    </box>
  );
}
