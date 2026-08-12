/**
 * PaneRow tests — the 2:5:3 (20/50/30) parent|current|preview layout primitive.
 *
 * Verified through the opentui test renderer's captured frames (the same
 * mechanism the `.harness` drive uses), since `flexGrow` ratios are only
 * observable in rendered output, not in unit-testable state.
 *
 *  • Unit: three columns render at 2:5:3 (e.g. 20/50/30 of 100) even when the
 *    parent and preview children are null, and the blank parent keeps its
 *    slot with a muted placeholder.
 *  • Integration: the current pane renders muted left/right border edges
 *    only (no full box, no accent ring) — `focused` toggles scroll-following
 *    but never changes the border; parent and preview stay borderless.
 *
 * Runs via `bun test`. The `[test] preload = "@opentui/solid/preload"` entry
 * in bunfig.toml registers the solid JSX transform for the test runner, so
 * JSX in this file compiles exactly like app code.
 */

import { describe, test, expect, afterAll } from "bun:test";
import { testRender } from "@opentui/solid";
import { ThemeProvider } from "../src/context/ThemeContext";
import { PaneRow } from "../src/components/PaneRow";

type Span = { text: string };
type Frame = { cols: number; lines: { spans: Span[] }[] };

/** Positions of all `│` border glyphs in the first body line that has any. */
function borderColumns(frame: Frame): number[] {
	const line = frame.lines.find((l) =>
		l.spans.some((s) => s.text.includes("│")),
	);
	if (!line) return [];
	const cols: number[] = [];
	let col = 0;
	for (const sp of line.spans) {
		for (const ch of sp.text) {
			if (ch === "│") cols.push(col);
			col++;
		}
	}
	return cols;
}

/**
 * Column widths, measured from the current pane's left/right border glyphs:
 * the parent runs from column 0 to the left border, the current pane spans
 * both borders, the preview runs from the right border to the frame's edge.
 */
function columnWidths(spans: Frame): number[] {
	const [a, b] = borderColumns(spans);
	if (b === undefined) return [];
	return [a, b - a + 1, spans.cols - b - 1];
}

/** Entire frame as plain text — used to assert no border glyphs remain. */
function frameText(spans: Frame): string {
	return spans.lines.map((l) => l.spans.map((s) => s.text).join("")).join("\n");
}

// Element children must be accessors (`() => JSX`): JSX elements are only
// constructed inside the renderer context (during the test render pass), so
// creating them eagerly in the test body would throw "No renderer found".
type TestPaneProps = {
	parent?: unknown;
	current?: (() => unknown) | unknown;
	preview?: unknown;
	focused?: unknown;
	currentBorder?: unknown;
	width?: number;
	height?: number;
};

async function renderPaneRow(props: TestPaneProps): Promise<{
	spans: Frame;
	destroy: () => Promise<void>;
}> {
	const setup = await testRender(
		() => (
			<ThemeProvider mode="dark">
				<PaneRow
					parent={props.parent as any}
					current={props.current as any}
					preview={props.preview as any}
					currentLabel="List"
					focused={props.focused as any}
					currentBorder={props.currentBorder as any}
				/>
			</ThemeProvider>
		),
		{ width: props.width ?? 100, height: props.height ?? 8, useThread: false },
	);
	// ThemeProvider only mounts its children once the theme resolves (async
	// palette/theme loading). Poll the title row until it renders, so the
	// captured frame below is actually a mounted PaneRow.
	let spans: Frame | null = null;
	for (let i = 0; i < 40 && !spans; i++) {
		await setup.renderOnce();
		const frame = setup.captureSpans() as unknown as Frame;
		const head = frame.lines[0]?.spans.map((s) => s.text).join("") ?? "";
		if (head.includes("List")) spans = frame;
		else await new Promise((r) => setTimeout(r, 100));
	}
	if (!spans) throw new Error("PaneRow did not render before timeout");
	return {
		spans,
		destroy: async () => {
			setup.renderer.destroy();
		},
	};
}

const cleanups: (() => void | Promise<void>)[] = [];
afterAll(async () => {
	for (const c of cleanups) {
		try {
			await c();
		} catch {
			// renderer already torn down — ignore
		}
	}
});

// ── Unit: three columns at 2:5:3 regardless of null children ───────────────
describe("PaneRow layout", () => {
	test("renders three columns at 2:5:3 even with null parent/preview", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
		});
		cleanups.push(destroy);

		const widths = columnWidths(spans);
		expect(widths).toHaveLength(3);
		const [p, c, v] = widths;
		// 100-wide row splits as 20 / 50 / 30 (2 : 5 : 3 of 10).
		expect(p).toBe(20);
		expect(c).toBe(50);
		expect(v).toBe(30);
		// Exact 2:5:3 proportion (within 1 col rounding).
		expect(c).toBeGreaterThanOrEqual(Math.round(p * 2.5) - 1);
		expect(c).toBeLessThanOrEqual(Math.round(p * 2.5) + 1);
		expect(v).toBeGreaterThanOrEqual(Math.round(p * 1.5) - 1);
		expect(v).toBeLessThanOrEqual(Math.round(p * 1.5) + 1);
		// Parent keeps a visibly non-zero slot and renders the muted placeholder.
		expect(p).toBeGreaterThan(4);
		const body = spans.lines
			.map((l) => l.spans.map((s) => s.text).join(""))
			.join("\n");
		expect(body).toContain("—");
		expect(body).toContain("ITEM");
	});

	test("keeps the 20% parent slot across widths (ratio stable)", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>x</text>,
			preview: null,
			width: 70,
		});
		cleanups.push(destroy);
		const [p, c, v] = columnWidths(spans);
		expect(p).toBe(14); // 70 → 14 / 35 / 21
		expect(c).toBe(35);
		expect(v).toBe(21);
	});
});

// ── Integration: the current pane carries muted left/right borders only ────
describe("PaneRow current-pane borders", () => {
	// The current column renders left/right edge glyphs (│) only — never a
	// full box. `focused` gates scroll-following but never changes the border
	// (always muted — no accent ring), and parent/preview stay borderless.
	const boxGlyphs = /[┌┐└┘─]/;

	test("focused=true renders left/right borders on the current pane only", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			focused: true,
		});
		cleanups.push(destroy);

		// 100-wide row splits as 20 / 50 / 30: the current pane's edges sit at
		// columns 20 and 69. No horizontal or corner glyphs — edges only.
		expect(borderColumns(spans)).toEqual([20, 69]);
		expect(frameText(spans)).not.toMatch(boxGlyphs);
	});

	test("focused=false renders the same muted borders (no accent ring)", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			focused: false,
		});
		cleanups.push(destroy);

		expect(borderColumns(spans)).toEqual([20, 69]);
		expect(frameText(spans)).not.toMatch(boxGlyphs);
	});

	test("accepts an accessor for focused (reactive boolean)", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			focused: () => true,
		});
		cleanups.push(destroy);
		expect(borderColumns(spans)).toEqual([20, 69]);
		expect(frameText(spans)).not.toMatch(boxGlyphs);

		const { spans: spans2, destroy: destroy2 } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			focused: () => false,
		});
		cleanups.push(destroy2);
		expect(borderColumns(spans2)).toEqual([20, 69]);
		expect(frameText(spans2)).not.toMatch(boxGlyphs);
	});

	test("defaults to focused (same muted borders)", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
		});
		cleanups.push(destroy);
		expect(borderColumns(spans)).toEqual([20, 69]);
		expect(frameText(spans)).not.toMatch(boxGlyphs);
	});

	test("currentBorder=['left'] removes the right edge (left only)", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			currentBorder: ["left"],
		});
		cleanups.push(destroy);
		// Only the left border glyph at column 20 — no right edge at 69.
		expect(borderColumns(spans)).toEqual([20]);
		expect(frameText(spans)).not.toMatch(boxGlyphs);
	});
});
