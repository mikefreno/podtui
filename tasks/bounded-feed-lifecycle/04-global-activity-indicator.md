# 04. Add a shared activity store and global top-right loading indicator

meta:
  id: bounded-feed-lifecycle-04
  feature: bounded-feed-lifecycle
  priority: P2
  depends_on: [bounded-feed-lifecycle-03]
  tags: [implementation, tests-required]

objective:

- One global indicator, always in the top-right corner of the app, visible whenever ANYTHING is being loaded or downloaded: feed refreshes (all-feeds and single-feed), fetch-more, subscribe fetches, searches, and episode downloads. Per-page spinners stay as-is; this adds the global signal that activity is happening anywhere.

background (read this before touching code):

- `src/components/Shell.tsx` renders the whole chrome: one full-width content row (`LayerGraph[nav.activeTab()]()` / `PaneRow`) plus a bottom status/command bar. There is no header row — the top-right corner belongs to whatever page is active, so the indicator must be an ABSOLUTE-POSITIONED overlay drawn after the content so it paints on top (opentui `box` supports `position="absolute"`, `top`, `right`).
- Existing activity signals (read them, don't recreate per-store bookkeeping): `useFeedStore().isLoadingFeeds()` / `.isLoadingMore()`; `useSearchStore().isSearching()` (`src/stores/search.ts`); `useDownloadStore().getActiveCount()` and `.getQueue().length` (`src/stores/download.ts`). Gaps these don't cover: single `refreshFeed`, `addFeed`'s subscribe fetch, iTunes feed resolution inside `addFeed` — hence the activity store.
- `src/components/LoadingIndicator.tsx` is the braille spinner (prop `label?: string`); reuse it inside the overlay.
- Activity tracking must be leak-proof: every `begin` paired with an `end` via a token, PLUS a `track(promise, label)` helper that auto-ends on settle so callers can't strand the counter.
- Task 03 added the incremental per-feed apply inside `refreshAllFeeds`; wire activity around the whole batch ( `isLoadingFeeds` already brackets it — prefer reusing the signal, adding explicit `begin/end` ONLY where no signal exists).
- Style: Solid + `@opentui/solid` JSX (no `className`; props like `fg`, `paddingRight`, `position`); store files tab-indented with semicolons; components match `LoadingIndicator.tsx` conventions. Style imports use `@/` alias in components, relative paths in stores.

deliverables:

- New `src/stores/activity.ts`:
  - Signals: `count` (number), `labels` (string[]).
  - Actions: `beginActivity(label: string): () => void` (returns the matching end function; each call adds the label, ending removes that exact instance — duplicates allowed), `track<T>(p: Promise<T>, label: string): Promise<T>` (begins, ends in `finally`, re-throws).
  - Computed: `isActive(): boolean` (`count() > 0`).
  - Singleton + `useActivityStore()` accessor, mirroring `src/stores/download.ts`'s module pattern.
- Wire the gaps in `src/stores/feed.ts` (only where no existing signal covers the operation):
  - `refreshFeed`: `await activity.track(...)` around the fetch+apply, label `"Refreshing"`.
  - `addFeed`: wrap the directory-resolve + `fetchEpisodes` stretch, label `"Subscribing"`.
  - Do NOT wrap `refreshAllFeeds`/`loadMoreEpisodes*` — `isLoadingFeeds`/`isLoadingMore` already cover them (double-counting just lengthens the spinner's on-time cosmetically; the point is no visual gap).
- New `src/components/GlobalActivityIndicator.tsx`:
  - Computes active state from: `feedStore.isLoadingFeeds() || feedStore.isLoadingMore() || searchStore.isSearching() || downloadStore.getActiveCount() + downloadStore.getQueue().length > 0 || activity.isActive()`.
  - Label selection: downloads in flight → `Downloading N` (+`M queued` when queue non-empty); else the activity store's latest label + `…` (e.g. `Refreshing…`); else `Loading…`.
  - Renders `<LoadingIndicator label={…} />` inside `<box position="absolute" top={0} right={0} paddingRight={1}>`; renders nothing (returns `null`) when inactive so it never eats layout when idle.
- `src/components/Shell.tsx`: mount `<GlobalActivityIndicator />` as the LAST child of the root `<box flexDirection="column" …>` (after the content row, bottom bar, and help overlay so it paints on top).
- `tests/global-activity-indicator.test.tsx` (new) — see tests section.

steps:

1. Read `src/stores/download.ts`, `src/stores/search.ts`, `src/components/LoadingIndicator.tsx`, and the render JSX of `src/components/Shell.tsx`.
2. Write `src/stores/activity.ts` (small; ~60 lines).
3. Wire `refreshFeed`/`addFeed` in `src/stores/feed.ts` via `useActivityStore().track(...)`. Import cycle note: `activity.ts` must import NOTHING from other stores (pure counter) so `feed.ts` importing it is safe.
4. Write `src/components/GlobalActivityIndicator.tsx`; mount it in `Shell.tsx` last (paints on top).
5. Write tests; run new tests, full suite, lint; manual smoke per validation.

tests:

- New `tests/global-activity-indicator.test.tsx` (component-test conventions: copy the render harness from `tests/feed-refresh-spinner.test.tsx` — temp `XDG_CONFIG_HOME` before imports; if a jsdom-like setup is used there, reuse it as-is):
  - Activity store unit asserts: two `begin`s → `isActive()` true; ending one → still true; ending both → false. `track(failingPromise)` still decrements (rejects propagate, counter returns to baseline).
  - Component asserts: render `<GlobalActivityIndicator />` in isolation —
    - idle → no text rendered;
    - `useActivityStore().beginActivity("Refreshing")` → spinner/label present in rendered output; matching end → gone;
    - with the download store: enqueue via `downloadStore.startDownload`-equivalent the way `tests/download-unsubscribed.test.ts` does (assert indicator renders while `getActiveCount() + queue > 0`); skip actual network by following that test's existing mocking pattern.
- Existing suites must pass: `feed-refresh-spinner.test.tsx` (per-page spinners unchanged), full `bun test`.

acceptance_criteria:

- Indicator visible in the top-right overlay while any of: all-feeds refresh, single-feed refresh, fetch-more, subscribe fetch, search, active/queued download — and hidden when none are active.
- Counter never strands: every completed/failed tracked operation returns `isActive()` to its prior value (proven by the `track` rejection test).
- Idle UI unchanged: when inactive the overlay renders nothing and occupies zero layout.
- `bun test` full suite passes; `bun run lint` clean.

validation:

- `bun test tests/global-activity-indicator.test.tsx tests/feed-refresh-spinner.test.tsx`
- `bun test`
- `bun run lint`
- Manual smoke: `bun start`; (a) on cold boot with subscriptions, the top-right spinner appears during startup refresh and disappears when done; (b) press `r` on Feed — spinner appears; (c) download an episode from Search — `Downloading` label shows while the transfer runs; (d) leave idle — top-right is empty.

notes:

- Depends on 03 only for ordering cleanliness — the activity wiring hooks onto the restructured refresh paths; nothing in 03's API is required beyond the store exporting the same signals.
- The overlay intentionally does NOT replace per-pane spinners (`Refreshing…` in Feed/MyShows/Discover/Search stay) — removing those is out of scope.
- If `position="absolute"` proves unavailable for text-draw ordering in `@opentui/solid`, the fallback is a dedicated 1-row header (`height={1}`) above the content row with the indicator right-aligned — only take this path with evidence (broken render), and note the tradeoff (loses one row of content height) in the commit message.
