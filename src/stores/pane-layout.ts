/**
 * pane-layout — global split positions for the yazi-style pane rows.
 *
 * Every tab renders its parent|current|preview columns through `PaneRow`
 * sharing one layout: the two borders of the CENTER (current) column are
 * draggable, and their positions are stored here as fractions of the row
 * width (so a terminal resize re-derives pixel positions proportionally).
 *
 *   parent (15+)  |  current (30+)  |  preview (15+)
 *   ── left ───────── right ────────   <-- draggable borders
 *
 * Defaults mirror the old fixed 2:5:3 ratio (20% / 50% / 30%). Minimum
 * pane widths are enforced in `splitPixels` whenever a border is dragged
 * or the row is re-derived. The positions persist to the app preferences
 * on `commit()` (drag end) — never per drag event, so drags don't thrash
 * config.json.
 */

import type { PaneSplits } from "@/types/settings";
import { createSignal } from "solid-js";
import { useAppStore } from "./app";

// ── Types ───────────────────────────────────────────────────────────────

/** Public surface of the shared pane-layout store. */
export interface PaneLayoutStore {
	/** Current split positions (fractions of the row width). */
	splits(): PaneSplits;
	/** Move the left border of the current pane to column `x`. */
	setLeft(x: number, width: number): void;
	/** Move the right border of the current pane to column `x`. */
	setRight(x: number, width: number): void;
	/** Persist the current splits (called on drag end, not per drag event). */
	commit(): void;
}

// ── Constants ───────────────────────────────────────────────────────────

/** Default split — the historical 2:5:3 ratio (parent 20 / current 50 / preview 30). */
export const DEFAULT_PANE_SPLITS: PaneSplits = { left: 0.2, right: 0.7 };

/** Per-pane minimum widths (columns) enforced while a border is being
 *  dragged. Static rendering maps stored fractions 1:1 to pixels — the
 *  minimums never distort the user's chosen layout on narrow terminals. */
export const MIN_PANE_WIDTH = {
	parent: 15,
	current: 30,
	preview: 15,
} as const;

/** Clamp `v` into [`lo`, `hi`] (bounds may invert on degenerate widths). */
function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

/** Minimum row width that can hold all three panes at their drag minimums. */
const MIN_TOTAL_WIDTH =
	MIN_PANE_WIDTH.parent + MIN_PANE_WIDTH.current + MIN_PANE_WIDTH.preview;

/** Resolve stored splits into concrete pixel columns for a row `width`.
 *  A pure 1:1 fraction→pixel mapping (keeping the ratio exact for every
 *  terminal size); min-width enforcement lives in the drag setters only. */
export function splitPixels(
	width: number,
	splits: PaneSplits,
): { leftPx: number; rightPx: number } {
	if (width <= 0) return { leftPx: 0, rightPx: 0 };
	const leftPx = Math.round(width * splits.left);
	const rightPx = Math.max(leftPx + 1, Math.round(width * splits.right));
	return { leftPx, rightPx };
}

export function createPaneLayoutStore(): PaneLayoutStore {
	const app = useAppStore();

	// Seeded from persisted preferences; `saved` is always defined because
	// the app store backfills the default when the config predates it.
	const [splits, setSplits] = createSignal<PaneSplits>(
		app.state().preferences.paneSplit ?? DEFAULT_PANE_SPLITS,
	);

	/** Store the normalized pixel positions as fractions of `width`. */
	const applyPixels = (leftPx: number, rightPx: number, width: number) => {
		if (width <= 0) return;
		setSplits({ left: leftPx / width, right: rightPx / width });
	};

	/** Clamp a dragged border to the per-pane minimums (only on terminals
	 *  wide enough to hold them; smaller rows just follow the cursor). */
	const dragPixels = (
		leftPx: number,
		rightPx: number,
		width: number,
	): { leftPx: number; rightPx: number } => {
		if (width < MIN_TOTAL_WIDTH)
			return {
				leftPx: clamp(leftPx, 1, width - 2),
				rightPx: Math.max(rightPx, leftPx + 1),
			};
		const minLeft = MIN_PANE_WIDTH.parent;
		const maxLeft = width - MIN_PANE_WIDTH.current - MIN_PANE_WIDTH.preview;
		const maxRight = width - MIN_PANE_WIDTH.preview;
		const newLeft = clamp(leftPx, minLeft, maxLeft);
		// The dragged border follows the cursor; the other border is pushed
		// only as far as needed to keep the current pane at its minimum.
		return {
			leftPx: newLeft,
			rightPx: clamp(rightPx, newLeft + MIN_PANE_WIDTH.current, maxRight),
		};
	};

	/** Move the left border to column `x` (the current pane's left edge). */
	const setLeft = (x: number, width: number) => {
		if (width <= 0) return;
		const { rightPx: curRight } = splitPixels(width, splits());
		const { leftPx, rightPx } = dragPixels(Math.round(x), curRight, width);
		applyPixels(leftPx, rightPx, width);
	};

	/** Move the right border to column `x` (the current pane's right edge). */
	const setRight = (x: number, width: number) => {
		if (width <= 0) return;
		const { leftPx: curLeft, rightPx: curRight } = splitPixels(width, splits());
		const { leftPx, rightPx } = dragPixels(curLeft, Math.round(x), width);
		applyPixels(leftPx, rightPx, width);
	};

	/** Persist the current splits (called on drag end, not per drag event). */
	const commit = () => {
		app.updatePreferences({ paneSplit: splits() });
	};

	return { splits, setLeft, setRight, commit };
}

// ── Singleton ───────────────────────────────────────────────────────────

let paneLayoutInstance: PaneLayoutStore | null = null;

/** Accessor for the shared pane-layout store (all tabs share one split). */
export function usePaneLayout(): PaneLayoutStore {
	if (!paneLayoutInstance) paneLayoutInstance = createPaneLayoutStore();
	return paneLayoutInstance;
}
