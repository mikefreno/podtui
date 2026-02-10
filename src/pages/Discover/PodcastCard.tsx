/**
 * PodcastCard component - Reusable card for displaying podcast info
 */

import { Show, For } from "solid-js";
import type { Podcast } from "@/types/podcast";
import { useTheme } from "@/context/ThemeContext";

type PodcastCardProps = {
  podcast: Podcast;
  selected: boolean;
  compact?: boolean;
  onSelect?: () => void;
  onSubscribe?: () => void;
};

export function PodcastCard(props: PodcastCardProps) {
  const { theme } = useTheme();
  const handleSubscribeClick = () => {
    props.onSubscribe?.();
  };

  return (
    <box
      flexDirection="column"
      padding={1}
      backgroundColor={props.selected ? theme.backgroundElement : undefined}
      onMouseDown={props.onSelect}
    >
      {/* Title Row */}
      <box flexDirection="row" gap={2} alignItems="center">
            <text fg={props.selected ? theme.primary : theme.text}>
              <strong>{props.podcast.title}</strong>
            </text>

        <Show when={props.podcast.isSubscribed}>
            <text fg={theme.success}>[+]</text>
        </Show>
      </box>

      {/* Author */}
      <Show when={props.podcast.author && !props.compact}>
            <text fg={theme.textMuted}>by {props.podcast.author}</text>
      </Show>

      {/* Description */}
      <Show when={props.podcast.description && !props.compact}>
            <text fg={props.selected ? theme.text : theme.textMuted}>
          {props.podcast.description!.length > 80
            ? props.podcast.description!.slice(0, 80) + "..."
            : props.podcast.description}
        </text>
      </Show>

      {/* Categories and Subscribe Button */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        marginTop={props.compact ? 0 : 1}
      >
        <box flexDirection="row" gap={1}>
          <Show when={(props.podcast.categories ?? []).length > 0}>
            <For each={(props.podcast.categories ?? []).slice(0, 2)}>
                {(cat) => <text fg={theme.warning}>[{cat}]</text>}
            </For>
          </Show>
        </box>

        <Show when={props.selected}>
          <box onMouseDown={handleSubscribeClick}>
            <text fg={props.podcast.isSubscribed ? theme.error : theme.success}>
              {props.podcast.isSubscribed ? "[Unsubscribe]" : "[Subscribe]"}
            </text>
          </box>
        </Show>
      </box>
    </box>
  );
}
