/**
 * Feed detail view component for PodTUI
 * Shows podcast info and episode list
 */

import { createSignal, For, Show } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { Feed } from "@/types/feed";
import type { Episode } from "@/types/episode";
import { format } from "date-fns";
import { useTheme } from "@/context/ThemeContext";
import { SelectableBox, SelectableText } from "@/components/Selectable";

interface FeedDetailProps {
  feed: Feed;
  focused?: boolean;
  onBack?: () => void;
  onPlayEpisode?: (episode: Episode) => void;
}

export function FeedDetail(props: FeedDetailProps) {
  const { theme } = useTheme();
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
        <box border padding={0} onMouseDown={props.onBack} borderColor={theme.border}>
            <SelectableText selected={() => false} primary>[Esc] Back</SelectableText>
        </box>
        <box border padding={0} onMouseDown={() => setShowInfo((v) => !v)} borderColor={theme.border}>
            <SelectableText selected={() => false} primary>[i] {showInfo() ? "Hide" : "Show"} Info</SelectableText>
        </box>
      </box>

      {/* Podcast info section */}
      <Show when={showInfo()}>
        <box border padding={1} flexDirection="column" gap={0} borderColor={theme.border}>
          <SelectableText selected={() => false} primary>
            <strong>{props.feed.customName || props.feed.podcast.title}</strong>
          </SelectableText>
          {props.feed.podcast.author && (
            <box flexDirection="row" gap={1}>
                <SelectableText selected={() => false} tertiary>by</SelectableText>
                <SelectableText selected={() => false} primary>{props.feed.podcast.author}</SelectableText>
            </box>
          )}
          <box height={1} />
          <SelectableText selected={() => false} tertiary>
            {props.feed.podcast.description?.slice(0, 200)}
            {(props.feed.podcast.description?.length || 0) > 200 ? "..." : ""}
          </SelectableText>
          <box height={1} />
          <box flexDirection="row" gap={2}>
            <box flexDirection="row" gap={1}>
              <SelectableText selected={() => false} tertiary>Episodes:</SelectableText>
              <SelectableText selected={() => false} tertiary>{props.feed.episodes.length}</SelectableText>
            </box>
            <box flexDirection="row" gap={1}>
              <SelectableText selected={() => false} tertiary>Updated:</SelectableText>
              <SelectableText selected={() => false} tertiary>{formatDate(props.feed.lastUpdated)}</SelectableText>
            </box>
            <SelectableText selected={() => false} tertiary>
              {props.feed.visibility === "public" ? "[Public]" : "[Private]"}
            </SelectableText>
            {props.feed.isPinned && <SelectableText selected={() => false} tertiary>[Pinned]</SelectableText>}
          </box>
        </box>
      </Show>

      {/* Episodes header */}
      <box flexDirection="row" justifyContent="space-between">
        <SelectableText selected={() => false} primary>
          <strong>Episodes</strong>
        </SelectableText>
        <SelectableText selected={() => false} tertiary>({episodes().length} total)</SelectableText>
      </box>

      {/* Episode list */}
      <scrollbox height={showInfo() ? 10 : 15} focused={props.focused}>
        <For each={episodes()}>
          {(episode, index) => (
            <SelectableBox
              selected={() => index() === selectedIndex()}
              flexDirection="column"
              gap={0}
              padding={1}
              onMouseDown={() => {
                setSelectedIndex(index());
                if (props.onPlayEpisode) {
                  props.onPlayEpisode(episode);
                }
              }}
            >
              <SelectableText
                selected={() => index() === selectedIndex()}
                primary
              >
                {index() === selectedIndex() ? ">" : " "}
              </SelectableText>
              <SelectableText
                selected={() => index() === selectedIndex()}
                primary
              >
                {episode.episodeNumber ? `#${episode.episodeNumber} - ` : ""}
                {episode.title}
              </SelectableText>
              <box flexDirection="row" gap={2} paddingLeft={2}>
                  <SelectableText selected={() => index() === selectedIndex()} tertiary>{formatDate(episode.pubDate)}</SelectableText>
                  <SelectableText selected={() => index() === selectedIndex()} tertiary>{formatDuration(episode.duration)}</SelectableText>
              </box>
            </SelectableBox>
          )}
        </For>
      </scrollbox>

      {/* Help text */}
      <text fg={theme.textMuted}>
        j/k to navigate, Enter to play, i to toggle info, Esc to go back
      </text>
    </box>
  );
}
