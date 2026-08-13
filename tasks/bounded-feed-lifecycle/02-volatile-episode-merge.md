# 02. Merge refreshes against the volatile in-memory episode window with a date-windowed cache

meta:
  id: bounded-feed-lifecycle-02
  feature: bounded-feed-lifecycle
  priority: P2
  depends_on: [bounded-feed-lifecycle-01]
  tags: [implementation, tests-required]

objective:

- Refreshing a feed must UNION the freshly fetched latest window with the episodes already in memory (instead of replacing), so episodes that task 01 pruned from disk — or deep episodes pulled in via "Fetch More" — survive refreshes within a session. Bound in-memory retention by the SAME date window persistence uses (`EPISODE_WINDOW_DAYS`, 30 days) instead of an episode count: the visible list and the pagination cache hold every episode from the last 30 days, and episodes older than that age out of the list on the next refresh (`fullEpisodeCache` currently holds every parsed episode of every feed ever fetched).

background (read this before touching code):

- All work lands in `src/stores/feed.ts` plus one new pure-utils module. Current behavior to change:
  - `fetchEpisodes(feedUrl, limit, feedId?)` parses the whole feed, stores ALL episodes in the module-level `fullEpisodeCache` Map, returns the first `limit`.
  - `refreshFeed` / `refreshAllFeeds` pass the fetched window through `applyRefreshedEpisodes`, which REPLACES `feed.episodes` when ids differ (`sameEpisodes` id-set compare; unchanged → keep object identity and skip save — this order-stability contract is pinned by `tests/feed-refresh.test.ts` and must keep passing).
  - `loadMoreEpisodesForFeed` grows the displayed window from `fullEpisodeCache` (fetching+parsing the full feed when the cache is cold — e.g. after a restart), tracking progress in `episodeLoadCount`.
- Task 01 made persistence prune everything over 30 days old (except completed downloads). After a restart, `feed.episodes` therefore only contains the 30-day persisted window; the full cached episode list is rebuilt lazily by the first fetch-more or refresh within the new session. This task makes the session-time behavior correct: fetched refreshes merge (never replace), and the volatile list + cache are bounded by the SAME 30-day window persistence uses — what can be browsed is exactly what can be persisted, and episodes older than the window age out on refresh.
- Style: `feed.ts` is tab-indented WITH semicolons. New utils file: match `src/api/rss-parser.ts` style (2-space, no semicolons).

deliverables:

- `src/utils/feeds-persistence.ts` (the canonical window owner):
  - Rename the retention constant to `EPISODE_WINDOW_DAYS = 30` — it now bounds the volatile cache/list as well as persistence.
  - New exported `episodeInWindow(ep: Episode, now: Date): boolean` — `pubDate >= now - EPISODE_WINDOW_DAYS`; missing/invalid pubDates are ALWAYS kept (fail-safe mirror of the persistence rule, so cache and disk can never disagree about an undatable episode). `episodeIsPersistable` becomes `downloadedIds.has(ep.id) || episodeInWindow(ep, now)`.
- Rework `src/utils/episode-merge.ts` (pure, store-free, unit-testable):
  - `mergeEpisodesInWindow(existing: Episode[], fetched: Episode[], now: Date): Episode[]` — union by `ep.id`; on id collision the `fetched` copy wins (fresh metadata); result sorted by `pubDate` descending; pruned to the lifecycle window via `episodeInWindow` (out-of-window episodes dropped, undated kept). No count cap — the bound is the date.
  - Invariants: never mutates inputs; stable output for `existing=[]`; entries with invalid `pubDate` sort as newest (use `getTime()`, treat `NaN` as `+Infinity` with a small `ts()` helper).
- `src/stores/feed.ts`:
  - Delete `MAX_EPISODES_IN_MEMORY` — no episode-count bound anywhere.
  - `fetchEpisodes`: window-filter the parsed feed (`allEpisodes.filter(ep => episodeInWindow(ep, new Date()))`) BEFORE caching and returning: `fullEpisodeCache.set(feedId, windowed)` and `episodes: windowed.slice(0, limit)`. The limit is a page size; the window is the bound.
  - `applyRefreshedEpisodes(prev, feedId, episodes)`: replace the `sameEpisodes` replace-with-fetched logic with merge semantics:
    - Compute `merged = mergeEpisodesInWindow(f.episodes, episodes, new Date())`.
    - Unchanged detection must compare the FETCHED window against the corresponding prefix of the existing list, i.e. keep a small `sameRefreshWindow(existing: Episode[], fetched: Episode[])` helper next to (and replacing the use of) `sameEpisodes`: `fetched.length === 0 → true`; otherwise compare id-sets of `fetched` and `existing.slice(0, fetched.length)`. Rationale: with union semantics `merged` legitimately contains episodes beyond the fetched window, so comparing full lists would bump `lastUpdated` on every refresh and resurrect the order-flapping bug `tests/feed-refresh.test.ts` guards.
    - Return unmodified `prev` when every feed's window is unchanged (preserve the existing identity-no-save contract); on change, set `{ ...f, episodes: merged, lastUpdated: new Date() }`.
    - Delete the now-unused `sameEpisodes` if nothing else references it (grep first: `grep sameEpisodes src tests`).
  - `loadMoreEpisodesForFeed`: window-filter the cold-refetch cache the same way after `parseEpisodesIncremental` (it's unsorted there — wrap with `sortEpisodesReverseChronological` before filtering). Fetch-more stepping is mode-dependent: DATE mode advances the loaded window by a `FETCH_MORE_WINDOW_DAYS` (14) band past the oldest loaded episode — a daily show gains ~2 weeks of episodes per press, not a fixed count — with a +1 minimum so a sparse band can't wedge the button into a no-op; COUNT mode keeps the fixed `MAX_EPISODES_REFRESH` (50) chunk. `hasMoreEpisodes` still compares `episodeLoadCount < cached.length`.
- `tests/feed-volatile-merge.test.ts` (reworked) — see tests section.

steps:

1. Read `src/stores/feed.ts` fully and `tests/feed-refresh.test.ts` + `tests/feed-pagination.test.ts` (they pin the contracts you must not break; reuse their harness).
2. Rework `src/utils/episode-merge.ts` to `mergeEpisodesInWindow`; add `episodeInWindow` (and rename `PERSISTED_WINDOW_DAYS` → `EPISODE_WINDOW_DAYS`) in `feeds-persistence.ts`.
3. Integrate in `feed.ts`: replace `sameEpisodes` usage with `sameRefreshWindow` + `mergeEpisodesInWindow` in `applyRefreshedEpisodes`; window-filter `fullEpisodeCache` writes and the returned window in `fetchEpisodes` and `loadMoreEpisodesForFeed`; delete `MAX_EPISODES_IN_MEMORY`.
4. Run the existing feed tests — all must pass unchanged (merge must keep order stability and pagination intact).
5. Write the new tests, run, then full suite + lint.

tests:

- New `tests/feed-volatile-merge.test.ts`:
  - Pure unit (Arrange–Act–Assert) for `mergeEpisodesInWindow(existing, fetched, now)`:
    - dedupe on collision, fetched copy wins (mutate title in the fetched twin, assert the merged entry shows the new title).
    - union of disjoint lists sorted by `pubDate` desc.
    - window prune drops out-of-window episodes from BOTH inputs and keeps undated (NaN pubDate) episodes.
    - input arrays not mutated.
  - Store integration (harness per `tests/feed-refresh.test.ts`: temp `XDG_CONFIG_HOME` BEFORE imports, `Bun.serve` on port 0 serving generated RSS, fake timers):
    - Refresh-keeps-volatile-window: serve 3 episodes at t0, `addFeed`; then serve the same 3 plus 2 new ones, `refreshFeed`. Assert `feed.episodes.length === 5` AND `lastUpdated` advanced AND a second identical refresh leaves `lastUpdated` untouched (window-compare, not union-compare).
    - Boundary: a 25-day-old episode loads; a 70-day-old episode is neither visible nor cached initially, but fetch-more surfaces it (volatile).
    - Date stepping: 30 episodes at 3-day spacing — each fetch-more press reveals the next 2-week band (24 → 28 → 30), NOT a fixed 50-chunk.
    - Out-of-window never cached: 600 items at 2h spacing span ~50 days — only the in-window tail is loadable (fewer than the old 500 cap), `hasMoreEpisodes` flips false there.
    - No count ceiling: 600 items at 1h spacing (all within 25 days) are ALL loadable — the bound is the date, not a number.
  - Clock constraint: these tests run under fake timers, and a large `vi.advanceTimersByTime` (past ~5 days of fake time) makes Bun 1.3.8 hang every subsequent network fetch — the boundary is pinned with relative pubDates, never by moving the clock across it.
- Existing suites that must keep passing: `tests/feed-refresh.test.ts`, `tests/feed-pagination.test.ts`, `tests/feed-refresh-spinner.test.tsx`.

acceptance_criteria:

- A refresh never removes an episode that was visible before the refresh during the same session — except episodes that aged past the window, which drop out on refresh (the date bound).
- An unchanged refresh does not bump `lastUpdated` (object identity of the feed is preserved).
- Per-feed cached/parsed episodes are exactly the in-window set: nothing outside the last `EPISODE_WINDOW_DAYS` days is cached or loadable, and everything inside is (no count ceiling).
- After a simulated restart (fresh store boot from a pruned config), fetch-more re-parses the feed and applies the same window to the cache.
- `bun test` full suite passes; `bun run lint` clean.

validation:

- `bun test tests/feed-volatile-merge.test.ts tests/feed-refresh.test.ts tests/feed-pagination.test.ts`
- `bun test`
- `bun run lint`
- Manual smoke: `bun start`, drill a show in My Shows, fetch-more a few pages, press `r` to refresh — the in-window pages stay; quit and relaunch — the list holds only the 30-day window, and fetch-more re-parses the feed with the same window applied.

notes:

- Depends on task 01 only conceptually: without the persisted-window prune, this merge is still correct but harder to observe. If 01 isn't merged yet, the store tests still pass; the "restart keeps only 30 days" manual check requires 01.
- `fullEpisodeCache`/`episodeLoadCount` are module-level Maps in `feed.ts` — the window filter belongs at the two write sites named in deliverables, not in a wrapper.
- Do not touch persistence writes in this task; debounced save behavior is task 03. Keep calling the module-scope `saveFeeds(updated)` helper exactly as today.
