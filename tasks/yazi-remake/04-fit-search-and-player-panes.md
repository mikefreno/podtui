# 04. Fit Search and Player into the 3-pane (1:3:3) model

meta:
  id: yazi-remake-04
  feature: yazi-remake
  priority: P2
  depends_on: [yazi-remake-01, yazi-remake-02]
  tags: [implementation, pages, tests-required]

objective:

- Bring the two fixed-layout tabs (Search, Player) into the same 1:3:3 parent|current|preview shell, deciding per-page whether to adopt the depth-stack or stay fixed-3-pane, while applying the new ratios throughout.

deliverables:

- `src/pages/Search/SearchPage.tsx` — rendered through `<YaziPaneRow>`; parent = query input + recent-search history, current = results list, preview = focused-result detail
- `src/pages/Player/PlayerPage.tsx` — rendered through `<YaziPaneRow>`; current = now-playing transport, preview = episode description/notes, parent = blank placeholder (or compact episode list if available)
- Decision recorded in each file's header comment: depth-stack vs fixed-3-pane

steps:

- Read both pages to understand their current pane semantics
- Search: map INPUT→parent, RESULTS→current, DETAIL→preview inside `<YaziPaneRow>`. If the 1/7 parent slot is too narrow for the input box, widen parent for Search only by passing an override ratio OR move the query into current and results into parent — pick the option that keeps the input usable and document it
- Search: keep the `inputFocused` effect (Shell yields keys to `<input>` when current-pane focus is on the query) — adapt to whichever pane the input lives in
- Player: single content pane; parent = blank/placeholder (1/7), current = transport + progress + controls (3/7), preview = episode art/description/notes (3/7). If no preview data, render a muted placeholder but keep the slot
- Confirm fixed-pane tab swipe (h/l between parent/current/preview) still routes correctly for Search
- Run diagnostics

tests:

- Unit: Search's `handleSubmit` swipes to the results pane and sets focus index 0 (Arrange empty results, Act submit, Assert activePane === results pane & focusedIndex 0)
- Integration: Player renders with parent blank and the transport in current
- e2e (harness): Search shows query | results | detail at 1:3:3; Player shows blank | transport | notes at 1:3:3

acceptance_criteria:

- Both pages render via `<YaziPaneRow>` at 1:3:3
- Search input remains typeable (Shell yields keys when the query pane is focused)
- Player's transport is in the current pane with focus
- No layout collapse: parent & preview keep their slots even if blank

validation:

- `grep -rn "YaziPaneRow" src/pages/Search src/pages/Player` returns 2 files
- `lens_diagnostics` paths over both files severity=error → 0 findings
- Harness: navigate to Search, type a query, press Enter, see results in current + detail in preview; navigate to Player, see transport + notes

notes:

- Depends on 01 (pane model — though Search is fixed-pane, the model cleanup affects `swipe` bounds) and 02 (the primitive)
- If Search input at 1/7 is genuinely too tight (~14 cols at 100w), prefer moving the query into the current pane for Search only and the results into parent — but confirm width with the harness before committing
- Player is single-content; the 1:3:3 with blanks is mostly cosmetic but keeps the layout globally consistent
