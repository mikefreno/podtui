/**
 * FeedPage - Shows latest episodes across all subscribed shows
 * Reverse chronological order, like an inbox/timeline
 */

import { createSignal, For, Show } from "solid-js";
import { useFeedStore } from "@/stores/feed";
import { format } from "date-fns";
import type { Episode } from "@/types/episode";
import type { Feed } from "@/types/feed";
import { useTheme } from "@/context/ThemeContext";
import { PageProps } from "@/App";

export const FeedPaneCount = 1;

export function FeedPage(props: PageProps) {
  const feedStore = useFeedStore();
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [isRefreshing, setIsRefreshing] = createSignal(false);

  const allEpisodes = () => feedStore.getAllEpisodesChronological();

  const formatDate = (date: Date): string => {
    return format(date, "MMM d, yyyy");
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

  const { theme } = useTheme();
  return (
    <box
      backgroundColor={theme.background}
      flexDirection="column"
      height="100%"
    >
      {/* Status line */}
      <Show when={isRefreshing()}>
        <text fg="yellow">Refreshing feeds...</text>
      </Show>

      <Show
        when={allEpisodes().length > 0}
        fallback={
          <box padding={2}>
            <text fg="gray">
              No episodes yet. Subscribe to shows from Discover or Search.
            </text>
          </box>
        }
      >
        {/**TODO: figure out wtf to do here **/}
        <scrollbox height="100%" focused={true}>
          <For each={allEpisodes()}>
            {(item, index) => (
              <box
                flexDirection="column"
                gap={0}
                paddingLeft={1}
                paddingRight={1}
                paddingTop={0}
                paddingBottom={0}
                backgroundColor={
                  index() === selectedIndex() ? "#333" : undefined
                }
                onMouseDown={() => setSelectedIndex(index())}
              >
                <box flexDirection="row" gap={1}>
                  <text fg={index() === selectedIndex() ? "cyan" : "gray"}>
                    {index() === selectedIndex() ? ">" : " "}
                  </text>
                  <text fg={index() === selectedIndex() ? "white" : theme.text}>
                    {item.episode.title}
                  </text>
                </box>
                <box flexDirection="row" gap={2} paddingLeft={2}>
                  <text fg="cyan">{item.feed.podcast.title}</text>
                  <text fg="gray">{formatDate(item.episode.pubDate)}</text>
                  <text fg="gray">{formatDuration(item.episode.duration)}</text>
                </box>
              </box>
            )}
          </For>
        </scrollbox>
      </Show>
    </box>
  );
}
