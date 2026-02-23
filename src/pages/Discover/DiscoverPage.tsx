/**
 * DiscoverPage component - Main discover/browse interface for PodTUI
 */

import { createSignal, For, Show, onMount } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { useDiscoverStore, DISCOVER_CATEGORIES } from "@/stores/discover";
import { useTheme } from "@/context/ThemeContext";
import { PodcastCard } from "./PodcastCard";
import { SelectableBox, SelectableText } from "@/components/Selectable";
import { useNavigation } from "@/context/NavigationContext";
import { KeybindProvider, useKeybinds } from "@/context/KeybindContext";

enum DiscoverPagePaneType {
  CATEGORIES = 1,
  SHOWS = 2,
}
export const DiscoverPaneCount = 2;

export function DiscoverPage() {
  const discoverStore = useDiscoverStore();
  const [showIndex, setShowIndex] = createSignal(0);
  const [categoryIndex, setCategoryIndex] = createSignal(0);
  const nav = useNavigation();
  const keybind = useKeybinds();

  onMount(() => {
    useKeyboard(
      (keyEvent: any) => {
        const isDown = keybind.match("down", keyEvent);
        const isUp = keybind.match("up", keyEvent);
        const isCycle = keybind.match("cycle", keyEvent);
        const isSelect = keybind.match("select", keyEvent);

        if (isSelect) {
          const filteredPodcasts = discoverStore.filteredPodcasts();
          if (filteredPodcasts.length > 0 && showIndex() < filteredPodcasts.length) {
            setShowIndex(showIndex() + 1);
          }
          return;
        }

        const filteredPodcasts = discoverStore.filteredPodcasts();
        if (filteredPodcasts.length === 0) return;

        if (isDown) {
          setShowIndex((i) => (i + 1) % filteredPodcasts.length);
        } else if (isUp) {
          setShowIndex((i) => (i - 1 + filteredPodcasts.length) % filteredPodcasts.length);
        } else if (isCycle) {
          setShowIndex((i) => (i + 1) % filteredPodcasts.length);
        }
      },
      { release: false },
    );
  });

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
        borderColor={
          nav.activeDepth() != DiscoverPagePaneType.CATEGORIES
            ? theme.border
            : theme.accent
        }
        flexDirection="column"
        gap={1}
      >
        <text
          fg={
            nav.activeDepth() == DiscoverPagePaneType.CATEGORIES
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
                <SelectableBox
                  selected={isSelected}
                  onMouseDown={() => handleCategorySelect(category.id)}
                >
                  <SelectableText selected={isSelected} primary>
                    {category.icon} {category.name}
                  </SelectableText>
                </SelectableBox>
              );
            }}
          </For>
        </box>
      </box>
        <box
          flexDirection="column"
          flexGrow={1}
          border
          borderColor={
            nav.activeDepth() == DiscoverPagePaneType.SHOWS
              ? theme.accent
              : theme.border
          }
        >
          <box padding={1}>
            <SelectableText
              selected={() => false}
              primary={nav.activeDepth() == DiscoverPagePaneType.SHOWS}
            >
              Trending in{" "}
              {DISCOVER_CATEGORIES.find(
                (c) => c.id === discoverStore.selectedCategory(),
              )?.name ?? "All"}
            </SelectableText>
          </box>
          <box flexDirection="column" height="100%">
            <Show
              fallback={
                <box padding={2}>
                  {discoverStore.filteredPodcasts().length !== 0 ? (
                    <text fg={theme.warning}>Loading trending shows...</text>
                  ) : (
                    <text fg={theme.textMuted}>
                      No podcasts found in this category.
                    </text>
                  )}
                </box>
              }
              when={
                !discoverStore.isLoading() &&
                discoverStore.filteredPodcasts().length === 0
              }
            >
              <scrollbox
                focused={nav.activeDepth() == DiscoverPagePaneType.SHOWS}
              >
                <box flexDirection="column">
                  <For each={discoverStore.filteredPodcasts()}>
                    {(podcast, index) => (
                      <PodcastCard
                        podcast={podcast}
                        selected={
                          index() === showIndex() &&
                          nav.activeDepth() == DiscoverPagePaneType.SHOWS
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
