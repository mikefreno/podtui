# 02. Build the reusable 3-pane layout primitive (1:3:3 ratio, stable parent slot)

meta:
  id: yazi-remake-02
  feature: yazi-remake
  priority: P1
  depends_on: []
  tags: [implementation, layout, tests-required]

objective:

- Create one reusable `<YaziPaneRow>` primitive that renders three bordered columns (parent | current | preview) at a 1:3:3 grow ratio with a stable 1/7 parent slot even when blank, so every list tab shares an identical, layout-stable shell.

deliverables:

- `src/components/YaziPaneRow.tsx` — new component: props `parent`, `current`, `preview` (Solid JSX/accessors), `parentLabel`, `currentLabel`, `previewLabel`, `focused` (boolean, defaults to current)
- `src/utils/navigation.ts` — `PANE_RATIO` updated to `{ parent: 1, current: 3, preview: 3 }` (was `{ parent: 1, current: 4, preview: 3 }`)
- Each pane: bordered `scrollbox` + slim header label row (height=1)
- Parent pane keeps its 1/7 `flexGrow` slot even when empty (renders a muted placeholder, never `width:0`)
- Focus ring (border color = accent on current; muted `border` on parent & preview)

steps:

- Set `PANE_RATIO = { parent: 1, current: 3, preview: 3 }` in `utils/navigation.ts`
- Create `YaziPaneRow.tsx` exporting a component that lays out three `<box flexGrow={PANE_RATIO.x}>` columns in a row
- Each column: a height-1 header `<box>` with the label text, then a `<scrollbox height="100%" border borderColor=…>` rendering the passed children
- Thread a `theme` via `useTheme()` inside the primitive (don't require callers to pass colors)
- `focused` prop controls which column gets the accent border — default current; parent & preview always muted
- Ensure the parent column renders a muted placeholder box (e.g. a single `<text fg={muted}>—</text>` or empty) when its children are null, but critically keeps `flexGrow={PANE_RATIO.parent}` so width never collapses
- Add a JSDoc header describing the yazi 1:3:3 contract
- Run diagnostics on the new file

tests:

- Unit: the primitive renders three boxes with flexGrow 1/3/3 regardless of null children (Arrange null parent, render, Assert three columns present with correct flexGrow)
- Integration: toggling `focused` swaps the accent border onto the requested column
- e2e (harness): a page using the primitive shows three equal-ratio columns with the parent column visibly non-zero width even when blank

acceptance_criteria:

- `PANE_RATIO` is `{ parent: 1, current: 3, preview: 3 }`
- `YaziPaneRow` accepts parent/current/preview children + labels + focused
- Parent column width never collapses to 0 (stable 1/7 slot)
- Only the focused column shows the accent border

validation:

- `grep -n "PANE_RATIO" src/utils/navigation.ts` shows the new 1:3:3 values
- `lens_diagnostics` paths=[`src/components/YaziPaneRow.tsx`,`src/utils/navigation.ts`] severity=error → 0 findings
- Harness: render a throwaway page using `<YaziPaneRow>`; confirm 3 columns at 1:3:3 via the frame

notes:

- Independent of task 01 (no nav-state dependency) — can be built in parallel
- Callers (tasks 03/04) pass their own parent/current/preview JSX; the primitive is purely structural
- opentui scrollbox: use `focused` only on the current pane so scroll focus follows the cursor
