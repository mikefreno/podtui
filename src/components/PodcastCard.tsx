/**
 * PodcastCard component - Reusable card for displaying podcast info
 */

import { Show } from "solid-js"
import type { Podcast } from "../types/podcast"

type PodcastCardProps = {
  podcast: Podcast
  selected: boolean
  compact?: boolean
  onSelect?: () => void
  onSubscribe?: () => void
}

export function PodcastCard(props: PodcastCardProps) {
  const handleSubscribeClick = () => {
    props.onSubscribe?.()
  }

  return (
    <box
      flexDirection="column"
      padding={1}
      backgroundColor={props.selected ? "#333" : undefined}
      onMouseDown={props.onSelect}
    >
      {/* Title Row */}
      <box flexDirection="row" gap={2} alignItems="center">
        <text fg={props.selected ? "cyan" : "white"}>
          <strong>{props.podcast.title}</strong>
        </text>

        <Show when={props.podcast.isSubscribed}>
          <text fg="green">[+]</text>
        </Show>
      </box>

      {/* Author */}
      <Show when={props.podcast.author && !props.compact}>
        <text fg="gray">by {props.podcast.author}</text>
      </Show>

      {/* Description */}
      <Show when={props.podcast.description && !props.compact}>
        <text fg={props.selected ? "white" : "gray"}>
          {props.podcast.description!.length > 80
            ? props.podcast.description!.slice(0, 80) + "..."
            : props.podcast.description}
        </text>
      </Show>

      {/* Categories and Subscribe Button */}
      <box flexDirection="row" justifyContent="space-between" marginTop={props.compact ? 0 : 1}>
        <box flexDirection="row" gap={1}>
          <Show when={(props.podcast.categories ?? []).length > 0}>
            {(props.podcast.categories ?? []).slice(0, 2).map((cat) => (
              <text fg="yellow">[{cat}]</text>
            ))}
          </Show>
        </box>

        <Show when={props.selected}>
          <box onMouseDown={handleSubscribeClick}>
            <text fg={props.podcast.isSubscribed ? "red" : "green"}>
              {props.podcast.isSubscribed ? "[Unsubscribe]" : "[Subscribe]"}
            </text>
          </box>
        </Show>
      </box>
    </box>
  )
}
