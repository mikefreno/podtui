/**
 * FeedPage - Shows latest episodes across all subscribed shows
 * Reverse chronological order, like an inbox/timeline
 */

import { createSignal, For, Show } from "solid-js";
import { useFeedStore } from "@/stores/feed";
import { useKeyboard } from "@opentui/solid";
import { format } from "date-fns";
import type { Episode } from "@/types/episode";
import type { Feed } from "@/types/feed";
import { useTheme } from "@/context/ThemeContext";
import { PageProps } from "@/App";
import { SelectableBox, SelectableText } from "@/components/Selectable";
import { se } from "date-fns/locale";

enum FeedPaneType {
  FEED = 1,
}
export const FeedPaneCount = 1;

/** Episodes to load per batch */
const ITEMS_PER_BATCH = 50;

export function FeedPage(props: PageProps) {
  const feedStore = useFeedStore();
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [loadedEpisodesCount, setLoadedEpisodesCount] = createSignal(ITEMS_PER_BATCH);

  const allEpisodes = () => feedStore.getAllEpisodesChronological();

  const formatDate = (date: Date): string => {
    return format(date, "MMM d, yyyy");
  };

  const paginatedEpisodes = () => {
    const episodes = allEpisodes();
    return episodes.slice(0, loadedEpisodesCount());
  };

  const episodesByDate = () => {
    const groups: Record<string, { episode: Episode; feed: Feed }> = {};
    const sortedEpisodes = paginatedEpisodes();

    for (const episode of sortedEpisodes) {
      const dateKey = formatDate(new Date(episode.episode.pubDate));
      groups[dateKey] = episode;
    }

    return groups;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await feedStore.refreshAllFeeds();
    setIsRefreshing(false);
  };

  const handleScrollDown = async () => {
    if (feedStore.isLoadingMore() || !feedStore.hasMoreEpisodes()) return;
    await feedStore.loadMoreEpisodes();
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
        <scrollbox height="100%" focused={props.depth() == FeedPaneType.FEED}>
          <For
            each={Object.entries(episodesByDate()).sort(([a], [b]) =>
              b.localeCompare(a),
            )}
          >
            {([date, episode], groupIndex) => {
              const selected = () => groupIndex() === selectedIndex();
              return (
                <>
                  <box
                    flexDirection="column"
                    gap={0}
                    paddingLeft={1}
                    paddingRight={1}
                    paddingTop={1}
                    paddingBottom={1}
                  >
                    <SelectableText selected={() => false} primary>
                      {date}
                    </SelectableText>
                  </box>
                  <SelectableBox
                    selected={selected}
                    flexDirection="column"
                    gap={0}
                    paddingLeft={1}
                    paddingRight={1}
                    paddingTop={0}
                    paddingBottom={0}
                    onMouseDown={() => setSelectedIndex(groupIndex())}
                  >
                    <SelectableText selected={selected} primary>
                      {selected() ? ">" : " "}
                    </SelectableText>
                    <SelectableText selected={selected} primary>
                      {episode.episode.title}
                    </SelectableText>
                    <box flexDirection="row" gap={2} paddingLeft={2}>
                      <SelectableText selected={selected} primary>
                        {episode.feed.podcast.title}
                      </SelectableText>
                      <SelectableText selected={selected} tertiary>
                        {formatDate(episode.episode.pubDate)}
                      </SelectableText>
                      <SelectableText selected={selected} tertiary>
                        {formatDuration(episode.episode.duration)}
                      </SelectableText>
                    </box>
                  </SelectableBox>
                </>
              );
            }}
          </For>
          {/* Loading indicator */}
          <Show when={feedStore.isLoadingMore()}>
            <box padding={1}>
              <text fg={theme.textMuted}>Loading more episodes...</text>
            </box>
          </Show>
        </scrollbox>
      </Show>
    </box>
  );
}
