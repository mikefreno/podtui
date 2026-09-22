/**
 * useStableListFocus — keep the cursor on the SAME row (by id), not the same
 * index, when a lazy load inserts rows around it.
 *
 * The nav store keeps one integer focus per depth frame. That is correct
 * for j/k (each press moves exactly one row) but wrong when the LIST
 * changes underneath the cursor: a fetch-more press appends revealed
 * episodes ABOVE the "[Fetch More]" row (every feed's deeper history is
 * older than the union's tail), so the button's index shifts down and an
 * index-stable cursor silently lands on another row. In the Feed tab the
 * union can even gain rows in the MIDDLE (a revealed episode of one show
 * sorts newer than another show's already-visible deep rows), moving the
 * focused episode itself.
 *
 * Usage: pages call this hook with a stable row-id accessor (episode id,
 * show id, or the FETCH_MORE_ROW_ID sentinel for the button row) plus
 * read/write access to the nav frame focus. Whenever the row count
 * changes, the cursor is re-anchored onto the previously focused row:
 *   • still present  → cursor follows that row (index may change)
 *   • gone (removed) → keep the current, clamped index
 *
 * The id snapshot is taken on EVERY change of focus or rows (not just
 * count changes), so selection by mouse and j/k both re-anchor correctly.
 */
import { createEffect, on, untrack } from "solid-js";

/** Sentinel id for the "[Fetch More]" row — never collides with real ids. */
export const FETCH_MORE_ROW_ID = "__fetch-more__";

export function useStableListFocus(deps: {
 /** Total row count of the list this pane shows. */
 count: () => number;
 /** Stable id of the row at `index` (undefined for out-of-range). */
 getItemId: (index: number) => string | undefined;
 /** Current focused row index of this pane. */
 getFocus: () => number;
 /** Write the focused row index of this pane. */
 setFocus: (index: number) => void;
}): void {
 /** Focused row id at the time of the last snapshot. */
 let focusedId: string | undefined;

 // Snapshot the focused row's id whenever focus or rows change. Reading
 // the list here would also re-run on unrelated row-content changes, so
 // only the id resolution is untracked.
 createEffect(() => {
  const idx = deps.getFocus();
  untrack(() => {
   focusedId = deps.getItemId(idx);
  });
 });

 // Re-anchor after the row count changes (deferred: never on first run —
 // initial focus placement is the page's job).
 createEffect(
  on(
   deps.count,
   (count) => {
    if (focusedId === undefined) return;
    let next: number | null = null;
    for (let i = 0; i < count; i++) {
     if (deps.getItemId(i) === focusedId) {
      next = i;
      break;
     }
    }
    // Row gone (removed): leave the clamped index alone — the
    // page's own ensureFocus handles bounds.
    if (next === null) return;
    if (next !== deps.getFocus()) deps.setFocus(next);
   },
   { defer: true },
  ),
 );
}
