/**
 * PodcastCard component - Reusable card for displaying podcast info
 */

import { Show, For } from "solid-js";
import type { Podcast } from "@/types/podcast";
import { useTheme } from "@/context/ThemeContext";
import { SelectableBox, SelectableText } from "@/components/Selectable";

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
    <SelectableBox
      selected={() => props.selected}
      flexDirection="column"
      padding={1}
      onMouseDown={props.onSelect}
    >
      <box flexDirection="row" gap={2} alignItems="center">
        <SelectableText selected={() => props.selected}>
          <strong>{props.podcast.title}</strong>
        </SelectableText>

        <Show when={props.podcast.isSubscribed}>
          <text fg={theme.success}>[+]</text>
        </Show>
      </box>

      {/* Author */}
      <Show when={props.podcast.author && !props.compact}>
        <SelectableText
          selected={() => props.selected}
          fg={theme.textMuted}
        >
          by {props.podcast.author}
        </SelectableText>
      </Show>

      {/* Description */}
      <Show when={props.podcast.description && !props.compact}>
        <SelectableText
          selected={() => props.selected}
          fg={theme.text}
        >
          {props.podcast.description!.length > 80
            ? props.podcast.description!.slice(0, 80) + "..."
            : props.podcast.description}
        </SelectableText>
      </Show>

      {/**<box
        flexDirection="row"
        justifyContent="space-between"
        marginTop={props.compact ? 0 : 1}
      />**/}
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
    </SelectableBox>
  );
}
