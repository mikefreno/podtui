# 03. Convert Feed/MyShows/Discover/Settings to the shared parent|current|preview primitive

meta:
  id: yazi-remake-03
  feature: yazi-remake
  priority: P2
  depends_on: [yazi-remake-01, yazi-remake-02]
  tags: [implementation, pages, tests-required]

objective:

- Rewrite the four depth-stack list tabs to render through `<YaziPaneRow>`, with the previous-depth list now visible in the parent pane (blank at depth 0), the current-depth list in current, and the hovered item in preview — eliminating per-page bespoke 3-column JSX.

deliverables:

- `src/pages/Feed/FeedPage.tsx` — rewritten to use `<YaziPaneRow>`; parent = previous-depth list, current = current-depth list, preview = hovered item detail
- `src/pages/MyShows/MyShowsPage.tsx` — same conversion
- `src/pages/Discover/DiscoverPage.tsx` — same conversion
- `src/pages/Settings/SettingsPage.tsx` — same conversion (sections → items → editor)
- Each page's `nav.action` handler retained but only acts on the current pane
- All per-page bespoke row/flexbox 3-column JSX removed

steps:

- For each of the four pages, read the current implementation to extract the parent/current/preview content builders
- Wrap the page body in `<YaziPaneRow parent={…} current={…} preview={…} focused={isActive} />`
- Parent pane: render the previous-depth frame's list (depth-1). At depth 0 the parent receives null/placeholder (the primitive keeps the slot)
- Current pane: the current-depth list, focusable, with `onMouseDown` row handlers calling `nav.setActivePane(DEPTH_CENTER_PANE)` + `nav.setDepthFocus(i, depth)`
- Preview pane: hovered-item detail derived from `focusedIndex(DEPTH_CENTER_PANE)` (unchanged logic, just relocated into the preview slot)
- Keep `pushDepth`/`popDepth` calls in the `open` action (drill) — behaviour unchanged, only layout changes
- Remove the old inline `<box flexGrow={PANE_RATIO.parent/current/preview}>` columns in favour of the primitive
- Verify each page's `nav.action` handler guards on `data.pane === DEPTH_CENTER_PANE && nav.activePane() === DEPTH_CENTER_PANE`

tests:

- Unit: each page's `open` action pushes a frame and the parent pane switches from blank to the previous list (Arrange depth 0, Act open, Assert stack length 2 and parent renders the old list)
- Integration: `h` (pop) returns parent to blank at depth 0; `l` (drill) populates parent with the previous list
- e2e (harness): Feed depth 0→1→2 shows parent blank → previous feeds list → previous episodes list; Settings sections→items→editor shows the chain in the parent pane

acceptance_criteria:

- All four pages render via `<YaziPaneRow>` (no bespoke 3-column JSX remains)
- Parent pane is blank at depth 0, populated at depth ≥ 1
- Drilling (l/Enter) populates the parent with the previous-depth list
- Popping (h) empties the parent back to blank at depth 0
- j/k move focus only within the current pane

validation:

- `grep -rn "YaziPaneRow" src/pages/` returns 4 files
- `lens_diagnostics` paths over the four page files severity=error → 0 findings
- Harness walk: `init` → navigate Feed → `l` (drill) → `l` (drill) → `h` (pop) → `h` (pop); confirm parent slot transitions blank→list→list→blank

notes:

- Depends on 01 (pane model) and 02 (the primitive) being merged
- The already-working `<Show when={item}>{(item) => (… item() …)}</Show>` accessor pattern for opentui `<Show>` callbacks must be preserved in preview panes
- Keep `LoadingIndicator` usages where they exist
