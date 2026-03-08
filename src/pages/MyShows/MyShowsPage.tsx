/**
 * MyShowsPage - Two-panel file-explorer style view
 * Left panel: list of subscribed shows
 * Right panel: episodes for the selected show
 */

import { createSignal, For, Show, createMemo, createEffect, onMount } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { useFeedStore } from "@/stores/feed";
import { useDownloadStore } from "@/stores/download";
import { DownloadStatus } from "@/types/episode";
import { format } from "date-fns";
import { useTheme } from "@/context/ThemeContext";
import { useAudioNavStore, AudioSource } from "@/stores/audio-nav";
import { useNavigation } from "@/context/NavigationContext";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { KeybindProvider, useKeybinds } from "@/context/KeybindContext";

enum MyShowsPaneType {
  SHOWS = 1,
  EPISODES = 2,
}

export const MyShowsPaneCount = 2;

export function MyShowsPage() {
  const feedStore = useFeedStore();
  const downloadStore = useDownloadStore();
  const audioNav = useAudioNavStore();
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [showIndex, setShowIndex] = createSignal(0);
  const [episodeIndex, setEpisodeIndex] = createSignal(0);
  const { theme } = useTheme();
  const mutedColor = () => theme.muted || theme.text;
  const nav = useNavigation();
  const keybind = useKeybinds();

  onMount(() => {
    useKeyboard(
      (keyEvent: any) => {
        const isDown = keybind.match("down", keyEvent);
        const isUp = keybind.match("up", keyEvent);
        const isCycle = keybind.match("cycle", keyEvent);
        const isSelect = keybind.match("select", keyEvent);
        const isInverting = keybind.isInverting(keyEvent);

        const shows = feedStore.getFilteredFeeds();
        const episodesList = episodes();

        if (isSelect) {
          if (shows.length > 0 && showIndex() < shows.length) {
            setShowIndex(showIndex() + 1);
          }
          if (episodesList.length > 0 && episodeIndex() < episodesList.length) {
            setEpisodeIndex(episodeIndex() + 1);
          }
          return;
        }

        // don't handle pane navigation here - unified in App.tsx
        if (nav.activeDepth() !== MyShowsPaneType.EPISODES) return;

        if (episodesList.length > 0) {
          if (isDown && !isInverting()) {
            setEpisodeIndex((i) => (i + 1) % episodesList.length);
          } else if (isUp && isInverting()) {
            setEpisodeIndex((i) => (i - 1 + episodesList.length) % episodesList.length);
          } else if ((isCycle && !isInverting()) || (isDown && !isInverting())) {
            setEpisodeIndex((i) => (i + 1) % episodesList.length);
          } else if ((isCycle && isInverting()) || (isUp && isInverting())) {
            setEpisodeIndex((i) => (i - 1 + episodesList.length) % episodesList.length);
          }
        }
      },
      { release: false },
    );
  });

  /** Threshold: load more when within this many items of the end */
  const LOAD_MORE_THRESHOLD = 5;

  const shows = () => feedStore.getFilteredFeeds();

  const selectedShow = createMemo(() => {
    return shows()[0]; //TODO: Integrate with locally handled keyboard navigation
  });

  const episodes = createMemo(() => {
    const show = selectedShow();
    if (!show) return [];
    return [...show.episodes].sort(
      (a, b) => b.pubDate.getTime() - a.pubDate.getTime(),
    );
  });

  const formatDate = (date: Date): string => {
    return format(date, "MMM d, yyyy");
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  /** Get download status label for an episode */
  const downloadLabel = (episodeId: string): string => {
    const status = downloadStore.getDownloadStatus(episodeId);
    switch (status) {
      case DownloadStatus.QUEUED:
        return "[Q]";
      case DownloadStatus.DOWNLOADING: {
        const pct = downloadStore.getDownloadProgress(episodeId);
        return `[${pct}%]`;
      }
      case DownloadStatus.COMPLETED:
        return "[DL]";
      case DownloadStatus.FAILED:
        return "[ERR]";
      default:
        return "";
    }
  };

  const handleRefresh = async () => {
    const show = selectedShow();
    if (!show) return;
    setIsRefreshing(true);
    await feedStore.refreshFeed(show.id);
    setIsRefreshing(false);
  };

  const handleUnsubscribe = () => {
    const show = selectedShow();
    if (!show) return;
    feedStore.removeFeed(show.id);
    setShowIndex((i) => Math.max(0, i - 1));
    setEpisodeIndex(0);
  };

  /** Get download status color */
  const downloadColor = (episodeId: string): string => {
    const status = downloadStore.getDownloadStatus(episodeId);
    switch (status) {
      case DownloadStatus.QUEUED:
        return theme.warning.toString();
      case DownloadStatus.DOWNLOADING:
        return theme.primary.toString();
      case DownloadStatus.COMPLETED:
        return theme.success.toString();
      case DownloadStatus.FAILED:
        return theme.error.toString();
      default:
        return mutedColor().toString();
    }
  };

  return (
    <box flexDirection="row" flexGrow={1} width="100%">
      <box flexDirection="column" height="100%">
        <Show when={isRefreshing()}>
          <text fg={theme.warning}>Refreshing...</text>
        </Show>
        <Show
          when={shows().length > 0}
          fallback={
            <box padding={1}>
              <text fg={theme.muted}>
                No shows yet. Subscribe from Discover or Search.
              </text>
            </box>
          }
        >
          <scrollbox
            border
            height="100%"
            borderColor={
              nav.activeDepth() == MyShowsPaneType.SHOWS
                ? theme.accent
                : theme.border
            }
            focused={nav.activeDepth() == MyShowsPaneType.SHOWS}
          >
            <For each={shows()}>
              {(feed, index) => (
                <box
                  flexDirection="row"
                  gap={1}
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={
                    index() === showIndex() ? theme.primary : undefined
                  }
                  onMouseDown={() => {
                    setShowIndex(index());
                    setEpisodeIndex(0);
                    audioNav.setSource(
                      AudioSource.MY_SHOWS,
                      selectedShow()?.podcast.id,
                    );
                  }}
                >
                  <text
                    fg={index() === showIndex() ? theme.surface : theme.text}
                  >
                    {index() === showIndex() ? ">" : " "}
                  </text>
                  <text
                    fg={index() === showIndex() ? theme.surface : theme.text}
                  >
                    {feed.customName || feed.podcast.title}
                  </text>
                  <text fg={index() === showIndex() ? undefined : theme.text}>
                    ({feed.episodes.length})
                  </text>
                </box>
              )}
            </For>
          </scrollbox>
        </Show>
      </box>
      <box flexDirection="column" height="100%">
          <Show
            when={selectedShow()}
            fallback={
              <box padding={1}>
                <text fg={theme.muted}>Select a show</text>
              </box>
            }
          >
            <Show
              when={episodes().length > 0}
              fallback={
                <box padding={1}>
                  <text fg={theme.muted}>No episodes. Press [r] to refresh.</text>
                </box>
              }
            >
              <scrollbox
                border
                height="100%"
                borderColor={
                  nav.activeDepth() == MyShowsPaneType.EPISODES
                    ? theme.accent
                    : theme.border
                }
                focused={nav.activeDepth() == MyShowsPaneType.EPISODES}
              >
              <For each={episodes()}>
                {(episode, index) => (
                  <box
                    flexDirection="column"
                    gap={0}
                    paddingLeft={1}
                    paddingRight={1}
                    backgroundColor={
                      index() === episodeIndex() ? theme.primary : undefined
                    }
                    onMouseDown={() => setEpisodeIndex(index())}
                  >
                    <box flexDirection="row" gap={1}>
                      <text
                        fg={
                          index() === episodeIndex()
                            ? theme.surface
                            : theme.text
                        }
                      >
                        {index() === episodeIndex() ? ">" : " "}
                      </text>
                      <text
                        fg={
                          index() === episodeIndex()
                            ? theme.surface
                            : theme.text
                        }
                      >
                        {episode.episodeNumber
                          ? `#${episode.episodeNumber} `
                          : ""}
                        {episode.title}
                      </text>
                    </box>
                    <box flexDirection="row" gap={2} paddingLeft={2}>
                      <text
                        fg={index() === episodeIndex() ? undefined : theme.info}
                      >
                        {formatDate(episode.pubDate)}
                      </text>
                      <text fg={theme.muted}>
                        {formatDuration(episode.duration)}
                      </text>
                      <Show when={downloadLabel(episode.id)}>
                        <text fg={downloadColor(episode.id)}>
                          {downloadLabel(episode.id)}
                        </text>
                      </Show>
                    </box>
                  </box>
                )}
              </For>
              <Show when={feedStore.isLoadingMore()}>
                <box paddingLeft={2} paddingTop={1}>
                  <LoadingIndicator />
                </box>
              </Show>
              <Show
                when={
                  !feedStore.isLoadingMore() &&
                  selectedShow() &&
                  feedStore.hasMoreEpisodes(selectedShow()!.id)
                }
              >
                <box paddingLeft={2} paddingTop={1}>
                  <text fg={theme.muted}>Scroll down for more episodes</text>
                </box>
              </Show>
            </scrollbox>
          </Show>
        </Show>
      </box>
    </box>
  );
}
