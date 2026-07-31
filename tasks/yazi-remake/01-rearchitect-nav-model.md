# 01. Rearchitect nav model — remove the sidebar pane

meta:
  id: yazi-remake-01
  feature: yazi-remake
  priority: P1
  depends_on: []
  tags: [implementation, nav-model, tests-required]

objective:

- Remove the always-on `SIDEBAR_PANE` concept from the navigation context so `activeTab` is plain tab state (not a pane), establishing clean parent|current|preview semantics for the yazi remake.

deliverables:

- `src/context/NavigationContext.tsx` — delete `SIDEBAR_PANE` constant and all references; `activeTab` is no longer a pane
- `src/utils/navigation.ts` — update `TabPaneCount` semantics; depth-tabs = 1 focusable pane (current), the 3 visible columns are a render concern not 3 panes
- Updated header/comment block describing the parent|current|preview model
- `swipe()` / `popDepth()` reworked: depth-tabs `l`=drill (`open`), `h`=pop (noop at depth 0); fixed-pane tabs `h/l` move between parent/current/preview
- Tab-enter resets focus to `DEPTH_CENTER_PANE` (current pane), not a sidebar

steps:

- Audit every reference to `SIDEBAR_PANE` across the codebase (grep)
- In `NavigationContext.tsx`: delete the `SIDEBAR_PANE = -1` export and the `focusedIndex`/`setFocusedIndex` SIDEBAR_PANE branch added previously
- Set the initial `activePane` signal and the tab-switch createEffect to reset to `DEPTH_CENTER_PANE` (the current pane), not `SIDEBAR_PANE`
- Rework `swipe()` to clamp to `[0, paneCount-1]` for fixed-pane tabs (the sidebar is no longer in the chain); depth-tabs don't use `swipe` for drill/pop (that lives in Shell dispatch)
- In `utils/navigation.ts`: confirm `TabPaneCount` reflects focusable content panes only (depth-tabs = 1, Search = 3, Player = 1); update `PANE_RATIO` leave-behind note (ratio change happens in task 02)
- Update the file header comment block to describe parent|current|preview
- Run `lens_diagnostics` on the two files

tests:

- Unit: `focusedIndex(DEPTH_CENTER_PANE)` on a depth-tab returns the top frame's focus; `setFocusedIndex` writes to the top frame (Arrange a tab with a 2-frame stack, Act by calling setFocusedIndex, Assert topFrame.focus updated)
- Integration: tab-switch effect sets `activePane` to `DEPTH_CENTER_PANE` (not -1); `swipe(-1, 3)` on a fixed tab clamps to 0 not -1
- e2e (harness): app boots with `nav.state.pane === 0` (current), not -1

acceptance_criteria:

- No symbol `SIDEBAR_PANE` exists anywhere in `src/`
- Initial `activePane` === `DEPTH_CENTER_PANE` (0)
- Tab-enter sets `activePane` to `DEPTH_CENTER_PANE`
- `swipe()` lower bound is 0 (no `-1`)

validation:

- `grep -rn "SIDEBAR_PANE" src/` returns nothing
- `bun run build` passes
- `lens_diagnostics` paths=[`src/context/NavigationContext.tsx`,`src/utils/navigation.ts`] severity=error → 0 findings

notes:

- This task unblocks 03/04/05/06. It must not delete `DEPTH_CENTER_PANE` — that constant is generalised to "the current pane" and retained
- `SIDEBAR_ACTIONS` (added in Shell in a prior turn) is removed in task 06 (the keybind rewrite), not here — but Shell will temporarily fail to compile after this task until 05/06 land; that's expected and the build command ignores type errors, so gate success on grep + targeted diagnostics, not the full build
