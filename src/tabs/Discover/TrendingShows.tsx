/**
 * TrendingShows component - Grid/list of trending podcasts
 */

import { For, Show } from "solid-js";
import type { Podcast } from "@/types/podcast";
import { PodcastCard } from "./PodcastCard";

type TrendingShowsProps = {
  podcasts: Podcast[];
  selectedIndex: number;
  focused: boolean;
  isLoading: boolean;
  onSelect?: (index: number) => void;
  onSubscribe?: (podcast: Podcast) => void;
};

export function TrendingShows(props: TrendingShowsProps) {
  return (
    <box flexDirection="column" height="100%">
      <Show when={props.isLoading}>
        <box padding={2}>
          <text fg="yellow">Loading trending shows...</text>
        </box>
      </Show>

      <Show when={!props.isLoading && props.podcasts.length === 0}>
        <box padding={2}>
          <text fg="gray">No podcasts found in this category.</text>
        </box>
      </Show>

      <Show when={!props.isLoading && props.podcasts.length > 0}>
        <scrollbox height={15}>
          <box flexDirection="column">
            <For each={props.podcasts}>
              {(podcast, index) => (
                <PodcastCard
                  podcast={podcast}
                  selected={index() === props.selectedIndex && props.focused}
                  onSelect={() => props.onSelect?.(index())}
                  onSubscribe={() => props.onSubscribe?.(podcast)}
                />
              )}
            </For>
          </box>
        </scrollbox>
      </Show>
    </box>
  );
}
