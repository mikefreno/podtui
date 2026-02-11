/**
 * Feed item component for PodTUI
 * Displays a single feed/podcast in the list
 */

import type { Feed, FeedVisibility } from "@/types/feed";
import { format } from "date-fns";
import { useTheme } from "@/context/ThemeContext";

interface FeedItemProps {
  feed: Feed;
  isSelected: boolean;
  showEpisodeCount?: boolean;
  showLastUpdated?: boolean;
  compact?: boolean;
}

export function FeedItem(props: FeedItemProps) {
  const formatDate = (date: Date): string => {
    return format(date, "MMM d");
  };

  const episodeCount = () => props.feed.episodes.length;
  const unplayedCount = () => {
    // This would be calculated based on episode status
    return props.feed.episodes.length;
  };

  const visibilityIcon = () => {
    return props.feed.visibility === "public" ? "[P]" : "[*]";
  };

  const visibilityColor = () => {
    return props.feed.visibility === "public" ? theme.success : theme.warning;
  };

  const pinnedIndicator = () => {
    return props.feed.isPinned ? "*" : " ";
  };

  const { theme } = useTheme();

  if (props.compact) {
    // Compact single-line view
    return (
      <box
        flexDirection="row"
        gap={1}
        backgroundColor={props.isSelected ? theme.backgroundElement : undefined}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={props.isSelected ? theme.primary : theme.textMuted}>
          {props.isSelected ? ">" : " "}
        </text>
        <text fg={visibilityColor()}>{visibilityIcon()}</text>
        <text fg={props.isSelected ? theme.text : theme.accent}>
          {props.feed.customName || props.feed.podcast.title}
        </text>
        {props.showEpisodeCount && (
          <text fg={theme.textMuted}>({episodeCount()})</text>
        )}
      </box>
    );
  }

  // Full view with details
  return (
    <box
      flexDirection="column"
      gap={0}
      border={props.isSelected}
      borderColor={props.isSelected ? theme.primary : undefined}
      backgroundColor={props.isSelected ? theme.primary : undefined}
      padding={1}
    >
      {/* Title row */}
      <box flexDirection="row" gap={1}>
        <text fg={props.isSelected ? theme.primary : theme.textMuted}>
          {props.isSelected ? ">" : " "}
        </text>
        <text fg={visibilityColor()}>{visibilityIcon()}</text>
        <text fg={theme.warning}>{pinnedIndicator()}</text>
        <text fg={props.isSelected ? theme.text : theme.text}>
          <strong>{props.feed.customName || props.feed.podcast.title}</strong>
        </text>
      </box>

      <box flexDirection="row" gap={2} paddingLeft={4}>
        {props.showEpisodeCount && (
          <text fg={theme.textMuted}>
            {episodeCount()} episodes ({unplayedCount()} new)
          </text>
        )}
        {props.showLastUpdated && (
          <text fg={theme.textMuted}>
            Updated: {formatDate(props.feed.lastUpdated)}
          </text>
        )}
      </box>

      {props.feed.podcast.description && (
        <box paddingLeft={4} paddingTop={0}>
          <text fg={theme.textMuted}>
            {props.feed.podcast.description.slice(0, 60)}
            {props.feed.podcast.description.length > 60 ? "..." : ""}
          </text>
        </box>
      )}
    </box>
  );
}
