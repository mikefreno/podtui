import { Show } from "solid-js";
import { format } from "date-fns";
import type { SearchResult } from "@/types/source";
import { SourceBadge } from "./SourceBadge";
import { useTheme } from "@/context/ThemeContext";

type ResultDetailProps = {
  result?: SearchResult;
  onSubscribe?: (result: SearchResult) => void;
};

export function ResultDetail(props: ResultDetailProps) {
  const { theme } = useTheme();
  return (
    <box flexDirection="column" border padding={1} gap={1} height="100%" borderColor={theme.border}>
      <Show
        when={props.result}
        fallback={          <text fg={theme.textMuted}>Select a result to see details.</text>}
      >
        {(result) => (
          <>
            <text fg={theme.text}>
              <strong>{result().podcast.title}</strong>
            </text>

            <SourceBadge
              sourceId={result().sourceId}
              sourceName={result().sourceName}
              sourceType={result().sourceType}
            />

            <Show when={result().podcast.author}>
              <text fg={theme.textMuted}>by {result().podcast.author}</text>
            </Show>

            <Show when={result().podcast.description}>
              <text fg={theme.textMuted}>{result().podcast.description}</text>
            </Show>

            <Show when={(result().podcast.categories ?? []).length > 0}>
              <box flexDirection="row" gap={1}>
                {(result().podcast.categories ?? []).map((category) => (
                  <text fg={theme.warning}>[{category}]</text>
                ))}
              </box>
            </Show>

            <text fg={theme.textMuted}>Feed: {result().podcast.feedUrl}</text>

            <text fg={theme.textMuted}>
              Updated: {format(result().podcast.lastUpdated, "MMM d, yyyy")}
            </text>

            <Show when={!result().podcast.isSubscribed}>
              <box
                border
                padding={0}
                paddingLeft={1}
                paddingRight={1}
                width={18}
                onMouseDown={() => props.onSubscribe?.(result())}
              >
                  <text fg={theme.primary}>[+] Add to Feeds</text>
              </box>
            </Show>

            <Show when={result().podcast.isSubscribed}>
              <text fg={theme.success}>Already subscribed</text>
            </Show>
          </>
        )}
      </Show>
    </box>
  );
}
