# 05. Rebuild Shell chrome — drop sidebar, add yazi bottom status/tab bar

meta:
  id: yazi-remake-05
  feature: yazi-remake
  priority: P1
  depends_on: [yazi-remake-01]
  tags: [implementation, shell-chrome, tests-required]

objective:

- Remove the always-on left tab sidebar entirely and replace it with a full-width page area above a slim yazi-style bottom bar that surfaces the active tab, depth/counts, selection, now-playing, and a discoverable tab strip.

deliverables:

- `src/components/Shell.tsx` — sidebar JSX deleted; render `LayerGraph[tab]()` full-width + a rebuilt bottom status/command bar
- Bottom bar (normal mode): mode label, `TAB_LABEL[tab] · depth N · i/len` (or `pane i/n` for fixed tabs), selection count `●N`, now-playing `♪ title`, pending-keybind hint, and a compact tab strip `[1]Feed [2]MyShows …` with the active tab marked
- Bottom bar (command mode): `:` prompt + buffer + error (unchanged, just relocated if needed)
- Help overlay kept; now-playing relocated from the old sidebar footer into the status bar

steps:

- Read `Shell.tsx` and delete the entire left tab sidebar `<box flexDirection="column" width={14}>…` block
- Replace the middle row with a single full-width `<box flexGrow={1}>{LayerGraph[nav.activeTab()]()}</box>`
- Rebuild the bottom bar: a height-1 `<box flexDirection="row">` with the fragments described above
- Tab strip: render `Object.values(TABS)` filtered to numbers; for each tab show `[N] Label` with the active tab inverted/highlighted (accent bg or `≡` marker)
- Status fragment: `nav.activePane() === DEPTH_CENTER_PANE ? (isDepthTab ? \`depth ${currentDepth()}\` : \`pane ${activePane()+1}/${count}\`) : 'tabs'` — but since the sidebar is gone, default to the depth/pane string (focus starts on current)
- Relocate `nowPlaying()` text from the sidebar footer into the bottom bar
- Keep `runCommand`, `handleCommandKey`, the help overlay, and `playEpisodeAndSwitch` untouched
- Run diagnostics

tests:

- Unit: `nowPlaying()` formats `♪ <truncated title>` (Arrange a current episode, Assert the string)
- Integration: switching tabs updates the tab strip's active marker and the status tab label
- e2e (harness): `init` shows no left sidebar, a full-width page, and a bottom bar containing the tab strip + `Feed · depth 0`; cycling tabs moves the strip's active marker

acceptance_criteria:

- No `width={14}` sidebar `<box>` remains in `Shell.tsx`
- The active page fills the full content width
- The bottom bar shows the active tab, depth, counts, selection, now-playing, and the tab strip
- The active tab is visually marked in the strip

validation:

- `grep -n "width={14}" src/components/Shell.tsx` returns nothing
- `grep -n "LayerGraph" src/components/Shell.tsx` shows the full-width render
- `lens_diagnostics` paths=[`src/components/Shell.tsx`] severity=error → 0 findings
- Harness: `init` frame has no sidebar column and shows the tab strip in the last row

notes:

- Depends on 01 (the pane model: focus starts on current, so the status fragment no longer needs the `SIDEBAR_PANE` branch)
- Task 06 rewrites the dispatch keybinds in this same file; do the chrome here and leave the dispatch `SIDEBAR_ACTIONS` branch for 06 to remove (or remove it here if 01 already deleted the constant — coordinate with 01)
- `playEpisodeAndSwitch` and the command bar must keep working
