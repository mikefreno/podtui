# 02. Merge refreshes against the volatile in-memory episode window with bounded per-feed caches

meta:
  id: bounded-feed-lifecycle-02
  feature: bounded-feed-lifecycle
  priority: P2
  depends_on: [bounded-feed-lifecycle-01]
  tags: [implementation, tests-required]

objective:

- Refreshing a feed must UNION the freshly fetched latest window with the episodes already in memory (instead of replacing), so episodes that task 01 pruned from disk — or deep episodes pulled in via "Fetch More" — survive refreshes within a session. Bound in-memory retention so memory stops growing unbounded (`fullEpisodeCache` currently holds every parsed episode of every feed ever fetched).

background (read this before touching code):

- All work lands in `src/stores/feed.ts` plus one new pure-utils module. Current behavior to change:
  - `fetchEpisodes(feedUrl, limit, feedId?)` parses the whole feed, stores ALL episodes in the module-level `fullEpisodeCache` Map, returns the first `limit`.
  - `refreshFeed` / `refreshAllFeeds` pass the fetched window through `applyRefreshedEpisodes`, which REPLACES `feed.episodes` when ids differ (`sameEpisodes` id-set compare; unchanged → keep object identity and skip save — this order-stability contract is pinned by `tests/feed-refresh.test.ts` and must keep passing).
  - `loadMoreEpisodesForFeed` grows the displayed window from `fullEpisodeCache` (fetching+parsing the full feed when the cache is cold — e.g. after a restart), tracking progress in `episodeLoadCount`.
- Task 01 made persistence prune everything over 30 days old (except completed downloads). After a restart, `feed.episodes` therefore only contains the 30-day persisted window; the full cached episode list is rebuilt lazily by the first fetch-more or refresh within the new session. This task makes the session-time behavior correct: old episodes stay browsable until the app exits, fetched refreshes never shrink the list.
- Style: `feed.ts` is tab-indented WITH semicolons. New utils file: match `src/api/rss-parser.ts` style (2-space, no semicolons).

deliverables:

- New `src/utils/episode-merge.ts` (pure, store-free, unit-testable):
  - `mergeEpisodes(existing: Episode[], fetched: Episode[], cap: number): Episode[]` — union by `ep.id`; on id collision the `fetched` copy wins (fresh metadata); result sorted by `pubDate` descending; truncated to `cap` entries (the OLDEST are dropped — after sorting, a plain `.slice(0, cap)`).
  - Invariants: never mutates inputs; stable output for `existing=[]`; entries with invalid `pubDate` sort as newest (use `getTime()`, treat `NaN` as `+Infinity` with a small `ts()` helper).
- `src/stores/feed.ts`:
  - New constant `MAX_EPISODES_IN_MEMORY = 500` (comment: per-feed bound on both the cached parse results and the merged in-memory window; 500 covers years of a weekly show's history while capping a 20-subscription install at 10k episodes).
  - `fetchEpisodes`: cap what goes into `fullEpisodeCache` — `fullEpisodeCache.set(feedId, allEpisodes.slice(0, MAX_EPISODES_IN_MEMORY))` (the array is already sorted newest-first via `sortEpisodesReverseChronological`). The LIMIT window returned to callers is unchanged.
  - `applyRefreshedEpisodes(prev, feedId, episodes)`: replace the `sameEpisodes` replace-with-fetched logic with merge semantics:
    - Compute `merged = mergeEpisodes(f.episodes, episodes, MAX_EPISODES_IN_MEMORY)`.
    - Unchanged detection must compare the FETCHED window against the corresponding prefix of the existing list, i.e. keep a small `sameRefreshWindow(existing: Episode[], fetched: Episode[])` helper next to (and replacing the use of) `sameEpisodes`: `fetched.length === 0 → true`; otherwise compare id-sets of `fetched` and `existing.slice(0, fetched.length)`. Rationale: with union semantics `merged` legitimately contains episodes beyond the fetched window, so comparing full lists would bump `lastUpdated` on every refresh and resurrect the order-flapping bug `tests/feed-refresh.test.ts` guards.
    - Return unmodified `prev` when every feed's window is unchanged (preserve the existing identity-no-save contract); on change, set `{ ...f, episodes: merged, lastUpdated: new Date() }`.
    - Delete the now-unused `sameEpisodes` if nothing else references it (grep first: `grep sameEpisodes src tests`).
  - `loadMoreEpisodesForFeed`: cap the cold-refetch cache the same way after `parseEpisodesIncremental` (it's unsorted there — wrap with `sortEpisodesReverseChronological` before capping); everything else (window growth by `MAX_EPISODES_REFRESH`, `hasMoreEpisodes` comparing `episodeLoadCount < cached.length`) works unchanged against the capped cache.
- `tests/feed-volatile-merge.test.ts` (new) — see tests section.

steps:

1. Read `src/stores/feed.ts` fully and `tests/feed-refresh.test.ts` + `tests/feed-pagination.test.ts` (they pin the contracts you must not break; reuse their harness).
2. Write `src/utils/episode-merge.ts` with `mergeEpisodes`.
3. Integrate in `feed.ts`: replace `sameEpisodes` usage with `sameRefreshWindow` + `mergeEpisodes` in `applyRefreshedEpisodes`; cap `fullEpisodeCache` writes in `fetchEpisodes` and `loadMoreEpisodesForFeed`; add `MAX_EPISODES_IN_MEMORY`.
4. Run the existing feed tests — all must pass unchanged (merge must keep order stability and pagination intact).
5. Write the new tests, run, then full suite + lint.

tests:

- New `tests/feed-volatile-merge.test.ts`:
  - Pure unit (Arrange–Act–Assert) for `mergeEpisodes`:
    - dedupe on collision, fetched copy wins (mutate title in the fetched twin, assert the merged entry shows the new title).
    - union of disjoint lists sorted by `pubDate` desc.
    - cap trimming drops the oldest: `cap=2`, three episodes spanning three days → the two newest survive.
    - input arrays not mutated.
  - Store integration (harness per `tests/feed-refresh.test.ts`: temp `XDG_CONFIG_HOME` BEFORE imports, `Bun.serve` on port 0 serving generated RSS, fake timers):
    - Refresh-keeps-volatile-window: serve 3 episodes at t0, `addFeed`; then serve the same 3 plus 2 new ones, `refreshFeed`. Assert `feed.episodes.length === 5` AND `lastUpdated` advanced AND a second identical refresh leaves `lastUpdated` untouched (window-compare, not union-compare).
    - Bounded cache: serve 600 items (generate programmatically), refresh, then `hasMoreEpisodes` grows only to the cap: loop `loadMoreEpisodes` until it returns false and assert total loaded ≤ `MAX_EPISODES_IN_MEMORY` (import the constant from the store module if exported, else assert `=== 500`).
- Existing suites that must keep passing: `tests/feed-refresh.test.ts`, `tests/feed-pagination.test.ts`, `tests/feed-refresh-spinner.test.tsx`.

acceptance_criteria:

- A refresh never removes an episode that was visible before the refresh during the same session.
- An unchanged refresh does not bump `lastUpdated` (object identity of the feed is preserved).
- Per-feed cached/parsed episodes never exceed `MAX_EPISODES_IN_MEMORY`; `loadMore` stops (hasMore → false) at the cap.
- After a simulated restart (fresh store boot from a pruned config), fetch-more re-parses the feed and can surface over-30-day episodes in volatile memory.
- `bun test` full suite passes; `bun run lint` clean.

validation:

- `bun test tests/feed-volatile-merge.test.ts tests/feed-refresh.test.ts tests/feed-pagination.test.ts`
- `bun test`
- `bun run lint`
- Manual smoke: `bun start`, drill a show in My Shows, fetch-more a few pages, press `r` to refresh — the deep pages stay; quit and relaunch — deep (over-30-day) pages are gone from the list but fetch-more brings them back.

notes:

- Depends on task 01 only conceptually: without the persisted-window prune, this merge is still correct but harder to observe. If 01 isn't merged yet, the store tests still pass; the "restart keeps only 30 days" manual check requires 01.
- `fullEpisodeCache`/`episodeLoadCount` are module-level Maps in `feed.ts` — the cap belongs at the two write sites named in deliverables, not in a wrapper.
- Do not touch persistence writes in this task; debounced save behavior is task 03. Keep calling the module-scope `saveFeeds(updated)` helper exactly as today.
