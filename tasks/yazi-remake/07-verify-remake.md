# 07. Verify the remake — build + diagnostics + harness walk-through

meta:
  id: yazi-remake-07
  feature: yazi-remake
  priority: P1
  depends_on: [yazi-remake-03, yazi-remake-04, yazi-remake-05, yazi-remake-06]
  tags: [verification, tests-required]
  status: BLOCKED  # see .harness/verification-07.md + tasks/yazi-remake/07-blocker-task-04-player-search.md

objective:

- Confirm the yazi remake meets every exit criterion via a clean build, zero diagnostics, and a full harness walk-through of every tab and depth.

deliverables:

- A passing `bun run build`
- `lens_diagnostics mode=all` with zero errors across edited files
- Harness frames + state proving the parent|current|preview 1:3:3 layout, drill/pop behaviour, tab switching, and status bar across all six tabs

steps:

- Run `bun run build` — expect "Build complete"
- Run `lens_diagnostics mode=all severity=error` — expect 0 findings across all session-edited files
- Run the drive harness (`scripts/tui-harness.tsx`) walk-through:
  - `init` → confirm no sidebar, 3 columns at 1:3:3, focus on current, bottom tab strip visible
  - Feed: `l` (depth 0→1, parent fills) → `l` (1→2) → `h` (2→1) → `h` (1→0, parent blanks) ; `j`/`k` move current
  - `2` → MyShows: drill show→episodes, parent reflects
  - `3` → Discover: category→results, parent shows categories
  - `6` → Settings: sections→items→editor, parent shows the previous list at each depth
  - `4` → Search: query|results|detail at 1:3:3; type + Enter works
  - `5` → Player: blank|transport|notes at 1:3:3
- Capture the status bar content (active tab + depth + counts + now-playing + tab strip) from a representative frame

tests:

- Build: `bun run build` exits 0 with "Build complete"
- Diagnostics: `lens_diagnostics` mode=all → 0 errors
- Harness (integration/e2e): the walk-through above produces the expected frames & state (parent blank at depth 0, populates on drill, blanks on pop; digits switch tabs; h noop at depth 0)

acceptance_criteria:

- `bun run build` passes
- `lens_diagnostics` mode=all reports zero errors
- All six tabs render 3 stable columns at 1:3:3
- Parent pane is blank at depth 0; drill fills it with the previous-depth list; pop empties it
- `h` is a noop at depth 0; `l` drills; `1-6`/`[`/`]` switch tabs; `j/k` move current only
- No sidebar; focus starts on current; bottom bar shows active tab + depth + counts + tab strip

validation:

- `bun run build 2>&1 | tail -3` → "Build complete"
- `lens_diagnostics` mode=all severity=error → "No error issues…"
- Harness `state nav` after `init` shows `pane === 0` (current), not -1
- Harness frames for Feed depth 0/1/2 show the parent slot transition blank→list→list

notes:

- This is the gate for the whole feature — do not mark done if any criterion fails; open a blocker task instead
- If the harness reveals a visual regression (e.g. parent collapses, ratios off), file it against the responsible task (02 or 03) rather than patching here
- Save a representative `.harness/last-frame.txt` snapshot if a visual reference is useful for future sessions
