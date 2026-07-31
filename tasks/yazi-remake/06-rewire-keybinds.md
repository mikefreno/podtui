# 06. Rewire keybinds — h/l drill+pop, digits switch tabs, focus starts on current

meta:
  id: yazi-remake-06
  feature: yazi-remake
  priority: P1
  depends_on: [yazi-remake-01, yazi-remake-05]
  tags: [implementation, keybinds, tests-required]

objective:

- Rewire the Shell dispatch so the sidebar's special-cased j/k branch is gone, h/l drill/pop on depth-tabs and swipe on fixed tabs, digit keys + `[ ]` are the sole tab switcher, and app focus starts on the current pane.

deliverables:

- `src/components/Shell.tsx` (dispatch) — `SIDEBAR_ACTIONS` set + the `if (nav.activePane() === SIDEBAR_PANE)` branch deleted
- `h`/`l` unified: depth-tabs `l`=current-drills (`open` emit), `h`=current-pops (noop at depth 0); fixed-pane tabs `h/l`=`swipe(∓1, count)`
- `1`-`6` / `tab-goto-*`, `tab-next`/`tab-prev` (`[`/`]`) — the only tab switchers
- Initial focus + tab-enter land on `DEPTH_CENTER_PANE`
- `keybinds.jsonc` reviewed (update labels/help only if needed)

steps:

- Read the current `dispatch()` (post task 01 it references a deleted `SIDEBAR_PANE` — fix the compile here)
- Remove the `SIDEBAR_ACTIONS` constant and its branch
- In the `default` case, implement: digit/tab-goto → `setActiveTab`; `swipe-prev` → (depth-tab & current & depth>0) `popDepth` else (depth-tab & current & depth==0) noop else `swipe(-1, count)`; `swipe-next` → (depth-tab & current) emit `open` else `swipe(1, count)`
- Move/list actions (`move-down/up`, `jump-*`, `page-*`, `goto-top/bottom`) flow to `PAGE_ACTIONS` → `emit("nav.action")` for the current pane only
- Confirm `escape`/`command`/`visual-mode`/`toggle-select`/audio/global branches unchanged
- Verify the app boot path sets focus to current (task 01 set the signal; confirm dispatch doesn't override)
- Run diagnostics + harness key sequence

tests:

- Unit: `dispatch("move-down")` on a depth-tab current pane emits `nav.action {action:"move-down"}` (Arrange current pane, Act, Assert emit)
- Integration: `dispatch("swipe-next")` on a depth-tab at depth 0 emits `open` (drill); `dispatch("swipe-prev")` at depth 1 pops to depth 0; at depth 0 `swipe-prev` is a noop
- e2e (harness): `l` drills (depth 0→1, parent populates), `h` pops (1→0, parent blanks), `1`/`2`/`3` switch tabs, `j`/`k` move the current list cursor without changing depth

acceptance_criteria:

- No `SIDEBAR_PANE` or `SIDEBAR_ACTIONS` references in `Shell.tsx`
- `h` at depth 0 is a noop (does not error, does not change pane)
- `l` at current on a depth-tab drills (depth+1)
- Digit keys switch tabs; focus lands on current pane
- `j`/`k` move within current only

validation:

- `grep -n "SIDEBAR" src/components/Shell.tsx` returns nothing
- `lens_diagnostics` paths=[`src/components/Shell.tsx`] severity=error → 0 findings
- Harness: `init` (focus on current) → `l` (depth 1, parent filled) → `l` (depth 2) → `h` (depth 1) → `h` (depth 0, parent blank) → `3` (Discover tab, focus on current) → `j`/`k` move

notes:

- Depends on 01 (pane model: `swipe` bounds, no SIDEBAR) and 05 (dispatch lives in the rebuilt Shell)
- If `keybinds.jsonc` has a `tab-next`/`tab-prev` mapping conflict, resolve here
- The noop `h` at depth 0 should feel inert (yazi: at root, `h` does nothing)
