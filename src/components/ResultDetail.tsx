import { Show } from "solid-js"
import { format } from "date-fns"
import type { SearchResult } from "../types/source"
import { SourceBadge } from "./SourceBadge"

type ResultDetailProps = {
  result?: SearchResult
  onSubscribe?: (result: SearchResult) => void
}

export function ResultDetail(props: ResultDetailProps) {
  return (
    <box flexDirection="column" border padding={1} gap={1} height="100%">
      <Show
        when={props.result}
        fallback={
          <text fg="gray">Select a result to see details.</text>
        }
      >
        {(result) => (
          <>
          <text fg="white">
            <strong>{result().podcast.title}</strong>
          </text>

            <SourceBadge
              sourceId={result().sourceId}
              sourceName={result().sourceName}
              sourceType={result().sourceType}
            />

          <Show when={result().podcast.author}>
            <text fg="gray">by {result().podcast.author}</text>
          </Show>

          <Show when={result().podcast.description}>
            <text fg="gray">{result().podcast.description}</text>
          </Show>

          <Show when={(result().podcast.categories ?? []).length > 0}>
            <box flexDirection="row" gap={1}>
              {(result().podcast.categories ?? []).map((category) => (
                <text fg="yellow">[{category}]</text>
              ))}
            </box>
          </Show>

          <text fg="gray">Feed: {result().podcast.feedUrl}</text>

          <text fg="gray">
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
                <text fg="cyan">[+] Add to Feeds</text>
              </box>
            </Show>

            <Show when={result().podcast.isSubscribed}>
              <text fg="green">Already subscribed</text>
            </Show>
          </>
        )}
      </Show>
    </box>
  )
}
