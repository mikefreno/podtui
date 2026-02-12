/**
 * Feed item component for PodTUI
 * Displays a single feed/podcast in the list
 */

import type { Feed, FeedVisibility } from "@/types/feed";
import { format } from "date-fns";
import { useTheme } from "@/context/ThemeContext";
import { SelectableBox, SelectableText } from "@/components/Selectable";

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
      <SelectableBox
        selected={() => props.isSelected}
        flexDirection="row"
        gap={1}
        paddingLeft={1}
        paddingRight={1}
        onMouseDown={() => {}}
      >
        <SelectableText
          selected={() => props.isSelected}
          fg={theme.primary}
        >
          {props.isSelected ? ">" : " "}
        </SelectableText>
        <SelectableText
          selected={() => props.isSelected}
          fg={visibilityColor()}
        >
          {visibilityIcon()}
        </SelectableText>
        <SelectableText
          selected={() => props.isSelected}
          fg={theme.text}
        >
          {props.feed.customName || props.feed.podcast.title}
        </SelectableText>
        {props.showEpisodeCount && (
          <SelectableText
            selected={() => props.isSelected}
            fg={theme.textMuted}
          >
            ({episodeCount()})
          </SelectableText>
        )}
      </SelectableBox>
    );
  }

  // Full view with details
  return (
    <SelectableBox
      selected={() => props.isSelected}
      flexDirection="column"
      gap={0}
      padding={1}
      onMouseDown={() => {}}
    >
      {/* Title row */}
      <box flexDirection="row" gap={1}>
        <SelectableText
          selected={() => props.isSelected}
          fg={theme.primary}
        >
          {props.isSelected ? ">" : " "}
        </SelectableText>
        <SelectableText
          selected={() => props.isSelected}
          fg={visibilityColor()}
        >
          {visibilityIcon()}
        </SelectableText>
        <SelectableText
          selected={() => props.isSelected}
          fg={theme.warning}
        >
          {pinnedIndicator()}
        </SelectableText>
        <SelectableText
          selected={() => props.isSelected}
          fg={theme.text}
        >
          <strong>{props.feed.customName || props.feed.podcast.title}</strong>
        </SelectableText>
      </box>

      <box flexDirection="row" gap={2} paddingLeft={4}>
        {props.showEpisodeCount && (
          <SelectableText
            selected={() => props.isSelected}
            fg={theme.textMuted}
          >
            {episodeCount()} episodes ({unplayedCount()} new)
          </SelectableText>
        )}
        {props.showLastUpdated && (
          <SelectableText
            selected={() => props.isSelected}
            fg={theme.textMuted}
          >
            Updated: {formatDate(props.feed.lastUpdated)}
          </SelectableText>
        )}
      </box>

      {props.feed.podcast.description && (
        <SelectableText
          selected={() => props.isSelected}
          paddingLeft={4}
          paddingTop={0}
          fg={theme.textMuted}
        >
          {props.feed.podcast.description.slice(0, 60)}
          {props.feed.podcast.description.length > 60 ? "..." : ""}
        </SelectableText>
      )}
    </SelectableBox>
  );
}
