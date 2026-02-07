import { Show } from "solid-js";
import type { SearchResult } from "@/types/source";
import { SourceBadge } from "./SourceBadge";

type ResultCardProps = {
  result: SearchResult;
  selected: boolean;
  onSelect: () => void;
  onSubscribe?: () => void;
};

export function ResultCard(props: ResultCardProps) {
  const podcast = () => props.result.podcast;

  return (
    <box
      flexDirection="column"
      padding={1}
      border={props.selected}
      borderColor={props.selected ? "cyan" : undefined}
      backgroundColor={props.selected ? "#222" : undefined}
      onMouseDown={props.onSelect}
    >
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <box flexDirection="row" gap={2} alignItems="center">
          <text fg={props.selected ? "cyan" : "white"}>
            <strong>{podcast().title}</strong>
          </text>
          <SourceBadge
            sourceId={props.result.sourceId}
            sourceName={props.result.sourceName}
            sourceType={props.result.sourceType}
          />
        </box>
        <Show when={podcast().isSubscribed}>
          <text fg="green">[Subscribed]</text>
        </Show>
      </box>

      <Show when={podcast().author}>
        <text fg="gray">by {podcast().author}</text>
      </Show>

      <Show when={podcast().description}>
        {(description) => (
          <text fg={props.selected ? "white" : "gray"}>
            {description().length > 120
              ? description().slice(0, 120) + "..."
              : description()}
          </text>
        )}
      </Show>

      <Show when={(podcast().categories ?? []).length > 0}>
        <box flexDirection="row" gap={1}>
          {(podcast().categories ?? []).slice(0, 3).map((category) => (
            <text fg="yellow">[{category}]</text>
          ))}
        </box>
      </Show>

      <Show when={!podcast().isSubscribed}>
        <box
          border
          padding={0}
          paddingLeft={1}
          paddingRight={1}
          width={18}
          onMouseDown={(event) => {
            event.stopPropagation?.();
            props.onSubscribe?.();
          }}
        >
          <text fg="cyan">[+] Add to Feeds</text>
        </box>
      </Show>
    </box>
  );
}
