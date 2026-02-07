/**
 * DiscoverPage component - Main discover/browse interface for PodTUI
 */

import { createSignal, For, Show } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { useDiscoverStore, DISCOVER_CATEGORIES } from "@/stores/discover";
import { useTheme } from "@/context/ThemeContext";
import { PodcastCard } from "./PodcastCard";

type DiscoverPageProps = {
  focused: boolean;
  onExit?: () => void;
};

type FocusArea = "categories" | "shows";

export function DiscoverPage(props: DiscoverPageProps) {
  const discoverStore = useDiscoverStore();
  const [focusArea, setFocusArea] = createSignal<FocusArea>("shows");
  const [showIndex, setShowIndex] = createSignal(0);
  const [categoryIndex, setCategoryIndex] = createSignal(0);

  // Keyboard navigation
  useKeyboard((key) => {
    if (!props.focused) return;

    const area = focusArea();

    // Tab switches focus between categories and shows
    if (key.name === "tab") {
      if (key.shift) {
        setFocusArea((a) => (a === "categories" ? "shows" : "categories"));
      } else {
        setFocusArea((a) => (a === "categories" ? "shows" : "categories"));
      }
      return;
    }

    if (key.name === "return" && area === "categories") {
      setFocusArea("shows");
      return;
    }

    // Category navigation
    if (area === "categories") {
      if (key.name === "left" || key.name === "h") {
        const nextIndex = Math.max(0, categoryIndex() - 1);
        setCategoryIndex(nextIndex);
        const cat = DISCOVER_CATEGORIES[nextIndex];
        if (cat) discoverStore.setSelectedCategory(cat.id);
        setShowIndex(0);
        return;
      }
      if (key.name === "right" || key.name === "l") {
        const nextIndex = Math.min(
          DISCOVER_CATEGORIES.length - 1,
          categoryIndex() + 1,
        );
        setCategoryIndex(nextIndex);
        const cat = DISCOVER_CATEGORIES[nextIndex];
        if (cat) discoverStore.setSelectedCategory(cat.id);
        setShowIndex(0);
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        // Select category and move to shows
        setFocusArea("shows");
        return;
      }
      if (key.name === "down" || key.name === "j") {
        setFocusArea("shows");
        return;
      }
    }

    // Shows navigation
    if (area === "shows") {
      const shows = discoverStore.filteredPodcasts();
      if (key.name === "down" || key.name === "j") {
        if (shows.length === 0) return;
        setShowIndex((i) => Math.min(i + 1, shows.length - 1));
        return;
      }
      if (key.name === "up" || key.name === "k") {
        if (shows.length === 0) {
          setFocusArea("categories");
          return;
        }
        const newIndex = showIndex() - 1;
        if (newIndex < 0) {
          setFocusArea("categories");
        } else {
          setShowIndex(newIndex);
        }
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        // Subscribe/unsubscribe
        const podcast = shows[showIndex()];
        if (podcast) {
          discoverStore.toggleSubscription(podcast.id);
        }
        return;
      }
    }

    if (key.name === "escape") {
      if (area === "shows") {
        setFocusArea("categories");
        key.stopPropagation();
      } else {
        props.onExit?.();
      }
      return;
    }

    // Refresh with 'r'
    if (key.name === "r") {
      discoverStore.refresh();
      return;
    }
  });

  const handleCategorySelect = (categoryId: string) => {
    discoverStore.setSelectedCategory(categoryId);
    const index = DISCOVER_CATEGORIES.findIndex((c) => c.id === categoryId);
    if (index >= 0) setCategoryIndex(index);
    setShowIndex(0);
  };

  const handleShowSelect = (index: number) => {
    setShowIndex(index);
    setFocusArea("shows");
  };

  const handleSubscribe = (podcast: { id: string }) => {
    discoverStore.toggleSubscription(podcast.id);
  };

  const { theme } = useTheme();
  return (
    <box flexDirection="row" flexGrow={1} height="100%" gap={1}>
      <box
        border
        padding={1}
        borderColor={theme.border}
        flexDirection="column"
        gap={1}
        width={20}
      >
        <text fg={focusArea() === "categories" ? theme.accent : theme.text}>
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
                  <text fg={isSelected() ? "cyan" : "gray"}>
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
          <text fg={focusArea() === "shows" ? "cyan" : "gray"}>
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
                  <text fg="yellow">Loading trending shows...</text>
                ) : (
                  <text fg="gray">No podcasts found in this category.</text>
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
                        index() === showIndex() && focusArea() === "shows"
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
