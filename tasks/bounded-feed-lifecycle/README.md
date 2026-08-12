# Bounded Feed Lifecycle

Objective: Bound feed episode storage to a rolling 30-day persisted window (older episodes volatile-only unless downloaded), keep feed loading nonblocking, and surface all load/download activity in a global top-right indicator.

Status legend: [ ] todo, [~] in-progress, [x] done

Tasks

- [x] 01 — persisted-retention-window → `01-persisted-retention-window.md`
- [x] 02 — volatile-episode-merge → `02-volatile-episode-merge.md`
- [x] 03 — nonblocking-feed-refresh → `03-nonblocking-feed-refresh.md`
- [x] 04 — global-activity-indicator → `04-global-activity-indicator.md`

Dependencies

- 02 depends on 01 (the volatile merge preserves exactly what 01 drops from disk)
- 03 depends on 01 (debounced persistence layers onto the pruning save path)
- 03 depends on 02 (incremental per-feed apply consumes the merge helper from 02)
- 04 depends on 03 (the indicator subscribes to the activity wiring added across refresh/load-more paths in 03)

Exit criteria

- After any refresh + save, `config.json` `feeds[*].episodes` contains only episodes with `pubDate` within the last 30 days or episodes marked `completed` in `downloads.json`; loading a legacy config prunes stale episodes on first launch.
- In-memory retention is capped per feed; episodes aged out of the persisted window remain browsable within the session and are re-fetchable via fetch-more after a restart.
- A refresh batch never exceeds a fixed fetch concurrency, applies each feed's result as it lands (no `Promise.all` barrier), and persistence writes are debounced; keyboard input stays responsive throughout.
- The top-right indicator is visible iff at least one feed refresh, fetch-more, subscribe fetch, search, or episode download is in flight, hidden otherwise.
- `bun test` and `bun run lint` pass.
