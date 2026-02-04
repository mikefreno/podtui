# PodTUI Navigation and Theming Improvements

Objective: Implement layered navigation system, fix tab crashes, and integrate sophisticated theming based on opencode

Status legend: [ ] todo, [~] in-progress, [x] done

Tasks
- [ ] 01 — Analyze current navigation and layer system → `01-analyze-navigation-system.md`
- [ ] 02 — Fix Discover tab crash → `02-fix-discover-tab-crash.md`
- [ ] 03 — Fix My Feeds tab crash → `03-fix-feeds-tab-crash.md`
- [ ] 04 — Fix Settings/Sources sub-tab crash → `04-fix-settings-sources-crash.md`
- [ ] 05 — Design layered navigation UI system → `05-design-layered-navigation-ui.md`
- [ ] 06 — Implement left/right layer navigation controls → `06-implement-layer-navigation-controls.md`
- [ ] 07 — Implement enter/escape layer navigation controls → `07-implement-enter-escape-controls.md`
- [ ] 08 — Design active layer background color system → `08-design-active-layer-colors.md`
- [ ] 09 — Create theme context provider → `09-create-theme-context-provider.md`
- [ ] 10 — Implement DesktopTheme type and structure → `10-implement-desktop-theme-types.md`
- [ ] 11 — Implement theme resolution system → `11-implement-theme-resolution.md`
- [ ] 12 — Create CSS variable token system → `12-create-css-token-system.md`
- [ ] 13 — Implement system theme detection → `13-implement-system-theme-detection.md`
- [ ] 14 — Integrate theme provider into App component → `14-integrate-theme-provider.md`
- [ ] 15 — Update components to use theme tokens → `15-update-components-to-use-themes.md`
- [ ] 16 — Test navigation flows and layer transitions → `16-test-navigation-flows.md`
- [ ] 17 — Test tab crash fixes and edge cases → `17-test-tab-crash-fixes.md`
- [ ] 18 — Test theming system with all modes → `18-test-theming-system.md`

Dependencies
- 01 depends on
- 02, 03, 04 depends on 01
- 05 depends on 02, 03, 04
- 06, 07, 08 depends on 05
- 16 depends on 06, 07, 08
- 09 depends on
- 10 depends on 09
- 11 depends on 10
- 12 depends on 11
- 13 depends on 12
- 14 depends on 13
- 15 depends on 14
- 18 depends on 15, 16, 17

Exit criteria
- Navigation is clearly visualized with layered backgrounds and active states
- Left/right keys navigate between layers, enter goes down, escape goes up
- All tabs (Discover, My Feeds, Settings) load without crashes
- Settings/Sources sub-tab loads without crashes
- Theming system works correctly with system/light/dark/auto modes
- All components use theme tokens consistently
- No hardcoded colors remain in components
- All tests pass and crashes are resolved
