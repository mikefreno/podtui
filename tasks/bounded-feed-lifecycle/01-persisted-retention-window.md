# 01. Persist only a 30-day episode window, keep downloaded episodes, clean up stale data

meta:
  id: bounded-feed-lifecycle-01
  feature: bounded-feed-lifecycle
  priority: P1
  depends_on: []
  tags: [implementation, tests-required]

objective:

- Bound what the app writes to `config.json`: each persisted feed keeps only episodes published within the last 30 days, plus any episode whose download is completed — everything older lives in volatile memory only (wired up in task 02). Loading an over-window legacy config must prune it automatically (cleanup on first launch).

background (read this before touching code):

- Feeds persist through `src/utils/feeds-persistence.ts`. `saveFeedsToFile(feeds)` is a fire-and-forget wrapper around `updateConfig({ feeds })` in `src/utils/config.ts`, which read-modify-writes the whole `config.json` behind a serialized promise chain (`writeChain`).
- Today `saveFeedsToFile` writes every loaded episode, so `config.json` grows forever (the Feed page's "Fetch More" keeps expanding `feed.episodes` and saving).
- Downloads persist separately in `downloads.json` (same config dir, see `src/utils/config-dir.ts` `getConfigFilePath("downloads.json")`). Each record has `episodeId`, `status`, `feedId`, etc. The `DownloadStatus` enum lives in `src/types/episode.ts` — read it there for the completed member's string value; do NOT hardcode a guessed string.
- `src/stores/feed.ts` calls `saveFeedsToFile` from a module-scope `saveFeeds()` helper. Callers must not change in this task.
- Style: match the file you edit. `feeds-persistence.ts` and `config.ts` are tab-indented WITH semicolons (some other repo files aren't — don't "fix" that anywhere).

deliverables:

- `src/utils/feeds-persistence.ts`:
  - New exported constant `PERSISTED_WINDOW_DAYS = 30`.
  - New exported pure function `episodeIsPersistable(ep: Episode, downloadedIds: Set<string>, now: Date): boolean` — returns `true` when:
    - `ep.pubDate` is missing/not a valid `Date` (fail-safe: never drop an undatable episode), OR
    - `ep.pubDate.getTime() >= now.getTime() - PERSISTED_WINDOW_DAYS * 24 * 3600 * 1000`, OR
    - `downloadedIds.has(ep.id)`.
  - New (module-private) async helper `readDownloadedEpisodeIds(): Promise<Set<string>>` — reads `getConfigFilePath("downloads.json")` with `Bun.file`, returns the `episodeId`s of records whose `status` equals `DownloadStatus.COMPLETED`; returns an empty set on any error or missing file. Note: an episode whose download is merely in-flight is NOT exempted; it will be re-included by the next save after completion, since the in-memory `feed.episodes` still holds it — document this in the function comment.
  - `saveFeedsToFile(feeds: Feed[])` — before calling `updateConfig`, map each feed to `{ ...feed, episodes: feed.episodes.filter(ep => episodeIsPersistable(ep, downloadedIds, new Date())) }`. The downloaded-ids lookup is async, so wrap the whole body in a fire-and-forget async IIFE (`.catch(() => {})`) that preserves the existing sync/fire-and-forget signature; on any lookup failure, save the feeds unpruned (never lose data on an error path).
  - `loadFeedsFromFile()` — after `reviveDates`, apply the same prune to the loaded feeds; if the prune removed at least one episode, call `saveFeedsToFile(pruned)` to rewrite `config.json` (this is the startup cleanup for legacy configs). `await` the prune path deterministically (the function is already async).
- `src/utils/config.ts`:
  - New exported `whenConfigIdle(): Promise<void>` returning the module-internal `writeChain` promise. Tests need a way to await pending serialized writes; today `updateConfig` hides the chain and tests cannot observe when a write lands.
- `tests/feed-retention.test.ts` (new) — see tests section.

steps:

1. Read `src/types/episode.ts` to confirm `DownloadStatus.COMPLETED`'s runtime value and the `Episode` shape (`id`, `pubDate`).
2. Read `src/utils/feeds-persistence.ts` and `src/utils/config.ts` fully (they are short).
3. Add `whenConfigIdle()` to `config.ts` next to `updateConfig`.
4. In `feeds-persistence.ts`: add imports (`getConfigFilePath` from `./config-dir`, `DownloadStatus` and `type Episode` from `../types/episode`), the constant, `episodeIsPersistable`, `readDownloadedEpisodeIds`, then rework `saveFeedsToFile` and `loadFeedsFromFile` per deliverables. Keep `reviveDates` untouched.
5. Ensure `saveFeeds` in `src/stores/feed.ts` still compiles unchanged (signature-compatible).
6. Write `tests/feed-retention.test.ts`, run it, then run the full suite and lint.

tests:

- Conventions (copy them): `tests/feed-refresh.test.ts` shows the harness — `mkdtempSync` into `process.env.XDG_CONFIG_HOME` **before** importing anything under test (module-level init reads the config dir), `rmSync` in `afterAll`, tabs/no-semicolon style not required but match repo.
- New `tests/feed-retention.test.ts`:
  - Unit (Arrange–Act–Assert) for `episodeIsPersistable`:
    - episode 40 days old, not downloaded → `false`.
    - episode 40 days old, id in `downloadedIds` → `true`.
    - episode 5 days old → `true`.
    - episode with `pubDate: new Date(NaN)` → `true` (fail-safe).
  - Save-path integration:
    - Arrange: write a `downloads.json` in the temp config dir containing one `completed` record for `old-downloaded-id` (include all fields the loader reads in `src/stores/download.ts`'s `DownloadRecord`: at minimum `episodeId`, `feedId`, `status`, `filePath: null`, `downloadedAt: null`, `fileSize: 0`, `error: null`, `audioUrl: ""`, `episodeTitle: ""`).
    - Act: call `saveFeedsToFile([feed])` where the feed has three episodes — recent, old-not-downloaded (`id: "old-plain-id"`), old-downloaded (`id: "old-downloaded-id"`). Await `whenConfigIdle()` (plus one more microtask/`await Promise.resolve()` round if the async IIFE resolves after the chain call — flush both).
    - Assert: parse `config.json` raw; the feed's persisted `episodes` contain the recent and `old-downloaded-id` episodes and NOT `old-plain-id`.
  - Load-path cleanup:
    - Arrange: seed `config.json` (write it directly with `Bun.write`) with one feed holding only over-window episodes; no `downloads.json`.
    - Act: `await loadFeedsFromFile()`, then `await whenConfigIdle()`.
    - Assert: returned feed has zero episodes AND re-reading `config.json` shows the episodes pruned (cleanup rewrite happened).

acceptance_criteria:

- `saveFeedsToFile` never writes an episode older than 30 days unless its id is a completed download in `downloads.json`.
- `loadFeedsFromFile` prunes over-window episodes from legacy configs and rewrites `config.json` when it pruned anything.
- Undatable episodes (`pubDate` missing/invalid) are always persisted.
- No call site of `saveFeedsToFile`/`loadFeedsFromFile` needed to change (compatible signatures).
- `bun test tests/feed-retention.test.ts` passes; the existing `bun test` suite passes; `bun run lint` is clean.

validation:

- `bun test tests/feed-retention.test.ts`
- `bun test` (full suite — watch `feed-refresh`/`feed-pagination` for regressions)
- `bun run lint`
- Manual smoke (optional): `bun start`, subscribe to any feed, quit, then `cat ~/.config/podtui/config.json | python3 -c "import sys,json; print(max(e['pubDate'] for f in json.load(sys.stdin)['feeds'] for e in f['episodes']))"` and confirm no persisted episode is older than 30 days.

notes:

- `updateConfig` captures the patched data eagerly at call time (`JSON.parse(JSON.stringify(patch))`), so pruning in `saveFeedsToFile` before the `updateConfig` call is exactly where the filter must live — filtering later would be silently ineffective for already-queued writes.
- This task intentionally does NOT change in-memory behavior, refresh merging, or cache bounds — that is task 02. If both are worked on in parallel, 02 imports nothing from 01 except the documented window semantics; the module-level contract above is the seam.
- `downloads.json` is written by `src/stores/download.ts` (`saveDownloads`); reading it directly here avoids a store→module import cycle (download.ts already imports the feed store).
