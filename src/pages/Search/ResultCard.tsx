import { Show } from "solid-js";
import type { SearchResult } from "@/types/source";
import { SourceBadge } from "./SourceBadge";
import { useTheme } from "@/context/ThemeContext";
import { SelectableBox, SelectableText } from "@/components/Selectable";

type ResultCardProps = {
  result: SearchResult;
  selected: boolean;
  onSelect: () => void;
  onSubscribe?: () => void;
};

export function ResultCard(props: ResultCardProps) {
  const { theme } = useTheme();
  const podcast = () => props.result.podcast;

  return (
    <SelectableBox
      selected={() => props.selected}
      flexDirection="column"
      padding={1}
      onMouseDown={props.onSelect}
    >
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <box flexDirection="row" gap={2} alignItems="center">
            <SelectableText
              selected={() => props.selected}
              fg={theme.primary}
            >
              <strong>{podcast().title}</strong>
            </SelectableText>
          <SourceBadge
            sourceId={props.result.sourceId}
            sourceName={props.result.sourceName}
            sourceType={props.result.sourceType}
          />
        </box>
        <Show when={podcast().isSubscribed}>
            <text fg={theme.success}>[Subscribed]</text>
        </Show>
      </box>

      <Show when={podcast().author}>
            <SelectableText
              selected={() => props.selected}
              fg={theme.textMuted}
            >
              by {podcast().author}
            </SelectableText>
      </Show>

      <Show when={podcast().description}>
        {(description) => (
            <SelectableText
              selected={() => props.selected}
              fg={theme.text}
            >
            {description().length > 120
              ? description().slice(0, 120) + "..."
              : description()}
          </SelectableText>
        )}
      </Show>

      <Show when={(podcast().categories ?? []).length > 0}>
        <box flexDirection="row" gap={1}>
          {(podcast().categories ?? []).slice(0, 3).map((category) => (
            <text fg={theme.warning}>[{category}]</text>
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
            <text fg={theme.primary}>[+] Add to Feeds</text>
        </box>
      </Show>
    </SelectableBox>
  );
}
