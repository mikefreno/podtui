# 03. Make refresh/fetch-more/persistence nonblocking — bounded fetch concurrency, incremental per-feed apply, debounced saves

meta:
  id: bounded-feed-lifecycle-03
  feature: bounded-feed-lifecycle
  priority: P1
  depends_on: [bounded-feed-lifecycle-01, bounded-feed-lifecycle-02]
  tags: [implementation, tests-required]

objective:

- Feed loading must never block or stall the UI: refresh results render as each feed lands instead of after a `Promise.all` barrier, fetch concurrency is capped so 50 subscriptions don't fire 50 simultaneous requests, and `config.json` writes (full file read-modify-write on every change today) collapse into one debounced trailing write per settle window.

background (read this before touching code):

- Work lands in `src/stores/feed.ts` only (plus its tests). Current posture:
  - `refreshAllFeeds()` fires `fetchEpisodes` for every feed at once via `Promise.all` and applies results in ONE `setFeeds` at the end — the user sees nothing until the slowest feed resolves or hits `FETCH_TIMEOUT_MS` (20s).
  - `parseEpisodesIncremental` already chunks XML parsing and yields to the event loop via MessageChannel — keep that mechanism untouched; the blocking/stall risk today is the fetch barrier and the save path.
  - `loadMoreEpisodesForFeed`'s cold-cache refetch has NO timeout (copy the `AbortSignal.timeout(FETCH_TIMEOUT_MS)` pattern from `fetchEpisodes`).
  - Persistence: `saveFeeds(updated)` → `saveFeedsToFile` → `updateConfig`, a serialized full-file read-`JSON.parse`-stringify-`Bun.write` chain in `src/utils/config.ts`. Called from `refreshFeed`, `refreshAllFeeds`, `loadMoreEpisodesForFeed`, `addFeed`, `removeFeed*`, `updateFeed`, `togglePinned`.
  - The boot IIFE calls `refreshAllFeeds()` right after `loadFeedsFromFile()` — this is the cold-start refresh users currently feel; first paint already happens because module init is async, but nothing renders per-feed until the barrier resolves.
  - Single feed `refreshFeed` applies its own `setFeeds` immediately — reuse exactly that shape (fetch → apply-if-changed → mark save dirty) for the incremental batch path.
- Tasks 01+02 must be merged first: this task debounces the pruned save path (01) and applies per-feed results through `applyRefreshedEpisodes`/`mergeEpisodes` (02).
- Style: tab-indented WITH semicolons, JSDoc comments on non-obvious functions, section dividers `// ── Name ──…` per repo convention.
- Tests here use `vi.useFakeTimers()` — `setTimeout`-based debounce must therefore be advanced with `vi.advanceTimersByTime` in tests; don't use `queueMicrotask`-style scheduling for the debounce.

deliverables:

- `src/stores/feed.ts`:
  - New constant `FETCH_CONCURRENCY = 4` (comment: bounds simultaneous RSS requests; a hung feed burns at most one slot for `FETCH_TIMEOUT_MS`).
  - New module-level async helper `mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]>` — classic worker-pool: `limit` workers pulling indexes from a shared counter, results in input order. Pure and generic enough to unit-test.
  - Rewritten `refreshAllFeeds()`:
    - `setIsLoadingFeeds(true)` … `finally setIsLoadingFeeds(false)` as today.
    - Process feeds through `mapWithConcurrency(feeds(), FETCH_CONCURRENCY, async (feed) => ...)`.
    - Inside the per-feed callback: `fetchEpisodes(feed.podcast.feedUrl, MAX_EPISODES_REFRESH, feed.id)`; if non-null, immediately `setFeeds(prev => { const updated = applyRefreshedEpisodes(prev, feed.id, episodes); if (updated !== prev) scheduleSaveFeeds(); return updated; })`. Failed feeds (null) stay untouched, as today.
    - After all workers settle: ONE `runAutoDownload()` (as today), and `flushPendingSave()` (below) so a refresh batch always ends with a persisted write when anything changed.
  - Debounced save plumbing (module scope, replacing direct calls):
    - `let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null; const SAVE_DEBOUNCE_MS = 250;`
    - `scheduleSaveFeeds()` — after a state-changing update, mark dirty: set a `savePending = true` flag and (re)arm the trailing timer to fire `flushPendingSave()`.
    - `flushPendingSave()` — if `savePending`, snapshot `feeds()`, call `saveFeeds(snapshot)`, clear flag/timer. Export it on the store's returned object (tests need it; also lets task 04/a future quit hook force a write).
    - Convert ALL direct `saveFeeds(updated)` / `saveFeeds(newList)` call sites inside `setFeeds` callbacks to `scheduleSaveFeeds()` EXCEPT `removeFeed`/`removeFeedByUrl`, which must call both `scheduleSaveFeeds()` AND `flushPendingSave()` (an unsubscribe intent should not sit unsaved through the debounce window if the process exits). Keep the change mechanical: same call sites, new indirection.
  - `loadMoreEpisodesForFeed`: add `signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)` to the cold refetch and return early on non-OK/throw (wrap in try/catch mirroring `fetchEpisodes`).
- `tests/feed-nonblocking.test.ts` (new) — see tests section.

steps:

1. Read `src/stores/feed.ts` and confirm tasks 01/02 are merged (`episodeIsPersistable` in `src/utils/feeds-persistence.ts`, `mergeEpisodes` in `src/utils/episode-merge.ts`).
2. Add `FETCH_CONCURRENCY`, `mapWithConcurrency`, and the debounce plumbing.
3. Rewrite `refreshAllFeeds` per deliverables; convert the save call sites.
4. Add the fetch timeout to `loadMoreEpisodesForFeed`'s cold refetch.
5. Export `flushPendingSave` from the store's return object (Actions section).
6. Write `tests/feed-nonblocking.test.ts`; run new + existing feed tests; full suite; lint.

tests:

- Harness conventions: copy `tests/feed-refresh.test.ts` (temp `XDG_CONFIG_HOME` BEFORE store imports; `Bun.serve` port 0; `vi.useFakeTimers()` in `beforeEach`). Note `vi.advanceTimersByTime(...)` also drives the debounce timer and the MessageChannel yields used by the parser are real task-queue turns (safe under fake timers per the comment on `yieldToUI`).
- New `tests/feed-nonblocking.test.ts`:
  - Concurrency bound: server records concurrent in-flight requests (increment on entry, `await new Promise(r => setTimeout(r, 50_000))` under fake-timer awareness: use a gate promise the test controls instead of real sleeps — release gates with `vi.advanceTimersByTime` after asserting). Register 10 feeds; start `refreshAllFeeds()` (don't await); assert the server's max-concurrent counter never exceeded 4; release all gates and await completion.
  - Incremental apply: 2 feeds — one served instantly, one gated. Start refresh; resolve the fast gate only; assert the fast feed's `lastUpdated`/episodes already updated in `feeds()` BEFORE the slow feed resolves (this is the acceptance proof the `Promise.all` barrier is gone). Then release the slow gate and assert both applied.
  - Debounce: mock-observe writes by seeding the temp config dir and spawning two rapid refreshes whose content changed; `await` both, then `vi.advanceTimersByTime(SAVE_DEBOUNCE_MS)`; read raw `config.json` ONCE — assert both new episodes are present in a single coherent write. (Counting writes precisely is brittle against `updateConfig`'s chain; asserting final content + that the pre-debounce file lacks the episodes is the binary check: before advancing the debounce, `config.json` must NOT yet contain the new episodes; after, it must.)
  - `flushPendingSave`: refresh with changed content, call `store.flushPendingSave()` without advancing timers, assert `config.json` already contains the new episode.
- Existing suites must pass unchanged: `feed-refresh.test.ts`, `feed-pagination.test.ts`, `feed-volatile-merge.test.ts`, `feed-refresh-spinner.test.tsx`, `restore-session.test.ts`.

acceptance_criteria:

- During a refresh batch, no more than `FETCH_CONCURRENCY` HTTP requests are ever in flight.
- Each feed's refreshed episodes are visible in `feeds()` as soon as its own fetch resolves — no waiting for the slowest feed.
- Writes to `config.json` are trailing-edge debounced: rapid successive updates produce one final write after the settle window, and `flushPendingSave()` persists immediately.
- `loadMoreEpisodesForFeed`'s refetch aborts at `FETCH_TIMEOUT_MS` instead of hanging forever.
- `bun test` full suite passes; `bun run lint` clean.

validation:

- `bun test tests/feed-nonblocking.test.ts tests/feed-refresh.test.ts tests/feed-pagination.test.ts tests/feed-volatile-merge.test.ts`
- `bun test`
- `bun run lint`
- Manual smoke: `bun start` with several subscriptions; hold `j` during the startup refresh — selection moves smoothly and per-feed results appear as they land; quit/relaunch and confirm the last refresh's episodes persisted.

notes:

- The background refresh timer (`scheduleNextRefresh`) already skips ticks while `isLoadingFeeds()` is true — unchanged.
- Do not introduce a real "sleep" anywhere in tests; gates + fake timers only, matching existing suites.
- `mapWithConcurrency` is generic; keep it module-private in `feed.ts` (no premature new util file).
- `updateConfig` snapshots its patch at call time (`JSON.parse(JSON.stringify(patch))`), so debouncing by delaying the `saveFeeds` CALL is correct — a pending write always serializes the latest feeds it was handed.
