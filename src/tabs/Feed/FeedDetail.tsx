/**
 * Feed detail view component for PodTUI
 * Shows podcast info and episode list
 */

import { createSignal, For, Show } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { Feed } from "@/types/feed";
import type { Episode } from "@/types/episode";
import { format } from "date-fns";

interface FeedDetailProps {
  feed: Feed;
  focused?: boolean;
  onBack?: () => void;
  onPlayEpisode?: (episode: Episode) => void;
}

export function FeedDetail(props: FeedDetailProps) {
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [showInfo, setShowInfo] = createSignal(true);

  const episodes = () => {
    // Sort episodes by publication date (newest first)
    return [...props.feed.episodes].sort(
      (a, b) => b.pubDate.getTime() - a.pubDate.getTime(),
    );
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (date: Date): string => {
    return format(date, "MMM d, yyyy");
  };

  const handleKeyPress = (key: { name: string }) => {
    const eps = episodes();

    if (key.name === "escape" && props.onBack) {
      props.onBack();
      return;
    }

    if (key.name === "i") {
      setShowInfo((v) => !v);
      return;
    }

    if (key.name === "up" || key.name === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.name === "down" || key.name === "j") {
      setSelectedIndex((i) => Math.min(eps.length - 1, i + 1));
    } else if (key.name === "return") {
      const episode = eps[selectedIndex()];
      if (episode && props.onPlayEpisode) {
        props.onPlayEpisode(episode);
      }
    } else if (key.name === "home" || key.name === "g") {
      setSelectedIndex(0);
    } else if (key.name === "end") {
      setSelectedIndex(eps.length - 1);
    } else if (key.name === "pageup") {
      setSelectedIndex((i) => Math.max(0, i - 10));
    } else if (key.name === "pagedown") {
      setSelectedIndex((i) => Math.min(eps.length - 1, i + 10));
    }
  };

  useKeyboard((key) => {
    if (!props.focused) return;
    handleKeyPress(key);
  });

  return (
    <box flexDirection="column" gap={1}>
      {/* Header with back button */}
      <box flexDirection="row" justifyContent="space-between">
        <box border padding={0} onMouseDown={props.onBack}>
          <text fg="cyan">[Esc] Back</text>
        </box>
        <box border padding={0} onMouseDown={() => setShowInfo((v) => !v)}>
          <text fg="cyan">[i] {showInfo() ? "Hide" : "Show"} Info</text>
        </box>
      </box>

      {/* Podcast info section */}
      <Show when={showInfo()}>
        <box border padding={1} flexDirection="column" gap={0}>
          <text>
            <strong>{props.feed.customName || props.feed.podcast.title}</strong>
          </text>
          {props.feed.podcast.author && (
            <box flexDirection="row" gap={1}>
              <text fg="gray">by</text>
              <text fg="cyan">{props.feed.podcast.author}</text>
            </box>
          )}
          <box height={1} />
          <text fg="gray">
            {props.feed.podcast.description?.slice(0, 200)}
            {(props.feed.podcast.description?.length || 0) > 200 ? "..." : ""}
          </text>
          <box height={1} />
          <box flexDirection="row" gap={2}>
            <box flexDirection="row" gap={1}>
              <text fg="gray">Episodes:</text>
              <text fg="white">{props.feed.episodes.length}</text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg="gray">Updated:</text>
              <text fg="white">{formatDate(props.feed.lastUpdated)}</text>
            </box>
            <text fg={props.feed.visibility === "public" ? "green" : "yellow"}>
              {props.feed.visibility === "public" ? "[Public]" : "[Private]"}
            </text>
            {props.feed.isPinned && <text fg="yellow">[Pinned]</text>}
          </box>
        </box>
      </Show>

      {/* Episodes header */}
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <strong>Episodes</strong>
        </text>
        <text fg="gray">({episodes().length} total)</text>
      </box>

      {/* Episode list */}
      <scrollbox height={showInfo() ? 10 : 15} focused={props.focused}>
        <For each={episodes()}>
          {(episode, index) => (
            <box
              flexDirection="column"
              gap={0}
              padding={1}
              backgroundColor={index() === selectedIndex() ? "#333" : undefined}
              onMouseDown={() => {
                setSelectedIndex(index());
                if (props.onPlayEpisode) {
                  props.onPlayEpisode(episode);
                }
              }}
            >
              <box flexDirection="row" gap={1}>
                <text fg={index() === selectedIndex() ? "cyan" : "gray"}>
                  {index() === selectedIndex() ? ">" : " "}
                </text>
                <text fg={index() === selectedIndex() ? "white" : undefined}>
                  {episode.episodeNumber ? `#${episode.episodeNumber} - ` : ""}
                  {episode.title}
                </text>
              </box>
              <box flexDirection="row" gap={2} paddingLeft={2}>
                <text fg="gray">{formatDate(episode.pubDate)}</text>
                <text fg="gray">{formatDuration(episode.duration)}</text>
              </box>
            </box>
          )}
        </For>
      </scrollbox>

      {/* Help text */}
      <text fg="gray">
        j/k to navigate, Enter to play, i to toggle info, Esc to go back
      </text>
    </box>
  );
}
