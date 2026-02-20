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
import { TABS } from "@/utils/navigation";

enum FeedPaneType {
  FEED = 1,
}
export const FeedPaneCount = 1;

/** Episodes to load per batch */
const ITEMS_PER_BATCH = 50;

export function FeedPage() {
  const feedStore = useFeedStore();
  const nav = useNavigation();
  const { theme } = useTheme();
  const [selectedEpisodeID, setSelectedEpisodeID] = createSignal<
    string | undefined
  >();
  const allEpisodes = () => feedStore.getAllEpisodesChronological();

  const formatDate = (date: Date): string => {
    return format(date, "MMM d, yyyy");
  };

  const groupEpisodesByDate = () => {
    const groups: Record<string, Array<{ episode: Episode; feed: Feed }>> = {};

    for (const item of allEpisodes()) {
      const dateKey = formatDate(new Date(item.episode.pubDate));
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    }

    return Object.entries(groups).sort(([a, _aItems], [b, _bItems]) => {
      // Convert date strings back to Date objects for proper chronological sorting
      const dateA = new Date(a);
      const dateB = new Date(b);
      // Sort in descending order (newest first)
      return dateB.getTime() - dateA.getTime();
    });
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  return (
    <box
      backgroundColor={theme.background}
      flexDirection="column"
      height="100%"
      width="100%"
    >
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
          <For each={groupEpisodesByDate()}>
            {([date, items]) => (
              <box flexDirection="column" gap={1} padding={1}>
                <SelectableText selected={() => false} primary>
                  {date}
                </SelectableText>
                <For each={items}>
                  {(item) => {
                    const isSelected = () => {
                      if (
                        nav.activeTab == TABS.FEED &&
                        nav.activeDepth == FeedPaneType.FEED &&
                        selectedEpisodeID() &&
                        selectedEpisodeID() === item.episode.id
                      ) {
                        return true;
                      }
                      return false;
                    };
                    return (
                      <SelectableBox
                        selected={isSelected}
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
                        <SelectableText selected={isSelected} primary>
                          {item.episode.title}
                        </SelectableText>
                        <box flexDirection="row" gap={2} paddingLeft={2}>
                          <SelectableText selected={isSelected} primary>
                            {item.feed.podcast.title}
                          </SelectableText>
                          <SelectableText selected={isSelected} tertiary>
                            {formatDuration(item.episode.duration)}
                          </SelectableText>
                        </box>
                      </SelectableBox>
                    );
                  }}
                </For>
              </box>
            )}
          </For>
        </scrollbox>
      </Show>
    </box>
  );
}
