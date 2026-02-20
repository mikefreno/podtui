/**
 * FeedPage - Shows latest episodes across all subscribed shows
 * Reverse chronological order, grouped by date
 */

import { createSignal, For, Show } from "solid-js";
import { useFeedStore } from "@/stores/feed";
import { format } from "date-fns";
import type { Episode } from "@/types/episode";
import type { Feed } from "@/types/feed";
import { useTheme } from "@/context/ThemeContext";
import { SelectableBox, SelectableText } from "@/components/Selectable";
import { useNavigation } from "@/context/NavigationContext";
import { LoadingIndicator } from "@/components/LoadingIndicator";

enum FeedPaneType {
  FEED = 1,
}
export const FeedPaneCount = 1;

/** Episodes to load per batch */
const ITEMS_PER_BATCH = 50;

export function FeedPage() {
  const feedStore = useFeedStore();
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [loadedEpisodesCount, setLoadedEpisodesCount] =
    createSignal(ITEMS_PER_BATCH);
  const nav = useNavigation();

  const allEpisodes = () => feedStore.getAllEpisodesChronological();

  const paginatedEpisodes = () => {
    const episodes = allEpisodes();
    return episodes.slice(0, loadedEpisodesCount());
  };

  const formatDate = (date: Date): string => {
    return format(date, "MMM d, yyyy");
  };

  const groupEpisodesByDate = () => {
    const groups: Record<string, Array<{ episode: Episode; feed: Feed }>> = {};
    const episodes = paginatedEpisodes();

    for (const item of episodes) {
      const dateKey = formatDate(new Date(item.episode.pubDate));
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    }

    return groups;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  const { theme } = useTheme();
  return (
    <box
      backgroundColor={theme.background}
      flexDirection="column"
      height="100%"
      width="100%"
    >
      {/* Status line */}
      <Show when={isRefreshing()}>
        <text fg={theme.warning}>Refreshing feeds...</text>
      </Show>

      <Show
        when={allEpisodes().length > 0}
        fallback={
          <box padding={2}>
            <text fg={theme.textMuted}>
              No episodes yet. Subscribe to shows from Discover or Search.
            </text>
          </box>
        }
      >
        <scrollbox height="100%" focused={nav.activeDepth == FeedPaneType.FEED}>
          <For each={Object.entries(groupEpisodesByDate()).sort(([a], [b]) => b.localeCompare(a))}>
            {([date, episodes]) => (
              <box flexDirection="column" gap={1} padding={1}>
                <SelectableText selected={() => false} primary>
                  {date}
                </SelectableText>
                <For each={episodes}>
                  {(item) => (
                    <SelectableBox
                      selected={() => false}
                      flexDirection="column"
                      gap={0}
                      paddingLeft={1}
                      paddingRight={1}
                      paddingTop={0}
                      paddingBottom={0}
                      onMouseDown={() => {
                        // Selection is handled by App's keyboard navigation
                      }}
                    >
                      <SelectableText selected={() => false} primary>
                        {item.episode.title}
                      </SelectableText>
                      <box flexDirection="row" gap={2} paddingLeft={2}>
                        <SelectableText selected={() => false} primary>
                          {item.feed.podcast.title}
                        </SelectableText>
                        <SelectableText selected={() => false} tertiary>
                          {formatDuration(item.episode.duration)}
                        </SelectableText>
                      </box>
                    </SelectableBox>
                  )}
                </For>
              </box>
            )}
          </For>
          {/* Loading indicator */}
          <Show when={feedStore.isLoadingMore()}>
            <box padding={1}>
              <LoadingIndicator />
            </box>
          </Show>
        </scrollbox>
      </Show>
    </box>
  );
}
