# Yazi UI Remake

Objective: Remake the PodTUI shell into a yazi-pure parent|current|preview 3-pane layout (1:3:3 ratio) with a bottom tab strip and no always-on sidebar.

Status legend: [ ] todo, [~] in-progress, [x] done

## Tasks

- [ ] 01 — rearchitect-nav-model → `01-rearchitect-nav-model.md`
- [ ] 02 — build-three-pane-layout-primitive → `02-build-three-pane-layout-primitive.md`
- [ ] 03 — convert-list-tabs-to-primitive → `03-convert-list-tabs-to-primitive.md`
- [ ] 04 — fit-search-and-player-panes → `04-fit-search-and-player-panes.md`
- [ ] 05 — rebuild-shell-chrome → `05-rebuild-shell-chrome.md`
- [ ] 06 — rewire-keybinds → `06-rewire-keybinds.md`
- [ ] 07 — verify-remake → `07-verify-remake.md`

## Dependencies

- 03 depends on 01
- 03 depends on 02
- 04 depends on 01
- 04 depends on 02
- 05 depends on 01
- 06 depends on 01
- 06 depends on 05
- 07 depends on 03
- 07 depends on 04
- 07 depends on 05
- 07 depends on 06

## Exit criteria

- The feature is complete when the left tab sidebar is gone; tabs switch only via digit keys `1-6` / `[ ]` and a bottom tab strip
- All tabs render three stable columns at 1/7 : 3/7 : 3/7 (parent | current | preview)
- The parent pane renders the previous-depth list and is blank (but keeps its 1/7 slot) at depth 0
- `h`/`l` drill (push) and pop depths on list tabs; `h` is a noop at depth 0
- `j`/`k` move within the current pane only; focus starts on the current pane
- Feed depth 0→1→2, MyShows, Discover, Settings (sections→items→editor), Search, and Player all render correctly via the drive harness
- `bun run build` passes and `lens_diagnostics` (mode=all) reports zero errors
- The bottom status bar shows active tab + depth + counts, selection count, now-playing, and the tab strip
