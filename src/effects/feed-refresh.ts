/**
 * Feed-refresh batch as an Effect program.
 *
 * Replaces the hand-rolled worker pool (mapWithConcurrency) + per-feed
 * fetch/apply plumbing in stores/feed.ts with Effect's structured
 * concurrency:
 *   - `Effect.forEach(..., { concurrency })` bounds in-flight fetches to
 *     `concurrency` (starts exactly that many fibers; each completion pulls
 *     the next feed — identical semantics to the old shared-counter pool).
 *   - `Effect.timeout` bounds each feed's fetch to `timeoutMs`. It runs
 *     through the `Clock` service, so under `TestContext` the TestClock
 *     drives it deterministically (no real 20s wait in tests).
 *   - Failures are folded to a null result: a failed or timed-out feed is
 *     left untouched instead of failing the batch.
 *   - The apply callback runs inside each feed's own fiber, so a feed's
 *     refreshed episodes land AS ITS OWN FETCH COMPLETES — the
 *     per-feed-apply-as-it-lands contract, no Promise.all barrier.
 *
 * The store boundary (stores/feed.ts) supplies the real fetch and apply
 * closures and runs the program with Effect.runPromise.
 */

import { Duration, Effect } from "effect"
import type { Episode } from "../types/episode"
import type { Feed } from "../types/feed"

/** Result of fetching one feed's RSS. `episodes: null` means the fetch
 *  failed or timed out — callers must leave that feed untouched. */
export interface RefreshFetchResult {
  episodes: Episode[] | null
  coverUrl: string | undefined
}

/** Result guaranteed to have parsed episodes (the apply path only). */
export interface RefreshSuccess {
  episodes: Episode[]
  coverUrl: string | undefined
}

export interface RefreshBatchOptions {
  /** Max simultaneous in-flight fetches. */
  concurrency: number
  /** Per-feed fetch timeout in milliseconds. */
  timeoutMs: number
}

/** Fold any failure (network error, timeout, rejection) to a null result so
 *  one bad feed can never fail the batch. */
const failedResult: RefreshFetchResult = { episodes: null, coverUrl: undefined }

/** Fetch one feed with a timeout, applying its result as its own fetch
 *  lands. A failed or timed-out fetch yields null — the feed is untouched. */
const refreshOne = (
  feed: Feed,
  fetchOne: (feed: Feed) => Promise<RefreshFetchResult>,
  applyOne: (feed: Feed, result: RefreshSuccess) => void,
  timeoutMs: number,
): Effect.Effect<void> =>
  Effect.tryPromise(() => fetchOne(feed)).pipe(
    Effect.timeout(Duration.millis(timeoutMs)),
    Effect.catchAll(() => Effect.succeed(failedResult)),
    Effect.flatMap((result) => {
      if (result.episodes === null) return Effect.void
      // Capture the narrowed array before the closure — TS drops the
      // `episodes !== null` narrowing inside Effect.sync's callback.
      const episodes = result.episodes
      return Effect.sync(() => applyOne(feed, { episodes, coverUrl: result.coverUrl }))
    }),
  )

/** Refresh every feed with bounded concurrency. Each feed's refreshed
 *  episodes are applied as its own fetch lands (no barrier); a failed or
 *  timed-out feed is left untouched. The program never fails — failures
 *  are folded to per-feed no-ops. */
export const refreshFeedsBatch = (
  feeds: readonly Feed[],
  fetchOne: (feed: Feed) => Promise<RefreshFetchResult>,
  applyOne: (feed: Feed, result: RefreshSuccess) => void,
  options: RefreshBatchOptions,
): Effect.Effect<void> =>
  Effect.forEach(
    feeds,
    (feed) => refreshOne(feed, fetchOne, applyOne, options.timeoutMs),
    { concurrency: options.concurrency, discard: true },
  )
