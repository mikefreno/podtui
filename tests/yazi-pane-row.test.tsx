/**
 * PaneRow tests — the 1:2:2 parent|current|preview layout primitive.
 *
 * Verified through the opentui test renderer's captured frames (the same
 * mechanism the `.harness` drive uses), since `flexGrow` ratios are only
 * observable as rendered column widths.
 *
 *  • Unit: three columns render at 1:2:2 (e.g. 20/40/40 of 100) even when the
 *    parent and preview children are null, and the blank parent keeps its
 *    slot with a muted placeholder.
 *  • Integration: the panes are fully borderless — `focused` toggles
 *    scroll-following but never surfaces a border or accent ring.
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

/** Column of the first span whose text contains `label` in the given line. */
function labelColumn(line: Frame["lines"][number], label: string): number {
	let col = 0;
	for (const sp of line.spans) {
		if (sp.text.includes(label)) return col;
		col += sp.text.length;
	}
	return -1;
}

/**
 * Column widths, measured from the header-label row (`Up|List|Detail`).
 * Each label box has a 1-col left padding, so a column's left edge is the
 * label start minus 1; the last column runs to the frame's right edge.
 */
function columnWidths(spans: Frame): number[] {
	const line = spans.lines[0];
	if (!line) return [];
	const up = labelColumn(line, "Up");
	const list = labelColumn(line, "List");
	const detail = labelColumn(line, "Detail");
	if (up < 0 || list < 0 || detail < 0) return [];
	return [list - up, detail - list, spans.cols - detail + 1];
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
					parentLabel="Up"
					currentLabel="List"
					previewLabel="Detail"
					focused={props.focused as any}
				/>
			</ThemeProvider>
		),
		{ width: props.width ?? 100, height: props.height ?? 8, useThread: false },
	);
	// ThemeProvider only mounts its children once the theme resolves (async
	// palette/theme loading). Poll the header-label row until it renders, so
	// the captured frame below is actually a mounted PaneRow.
	let spans: Frame | null = null;
	for (let i = 0; i < 40 && !spans; i++) {
		await setup.renderOnce();
		const frame = setup.captureSpans() as unknown as Frame;
		const head = frame.lines[0]?.spans.map((s) => s.text).join("") ?? "";
		if (head.includes("Up")) spans = frame;
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

// ── Unit: three columns at 1:2:2 regardless of null children ───────────────
describe("PaneRow layout", () => {
	test("renders three columns at 1:2:2 even with null parent/preview", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
		});
		cleanups.push(destroy);

		const widths = columnWidths(spans);
		expect(widths).toHaveLength(3);
		const [p, c, v] = widths;
		// 100-wide row splits as 20 / 40 / 40 (1/5 : 2/5 : 2/5).
		expect(p).toBe(20);
		expect(c).toBe(40);
		expect(v).toBe(40);
		// Exact 1:2:2 proportion (within 1 col rounding).
		expect(c).toBeGreaterThanOrEqual(p * 2 - 1);
		expect(c).toBeLessThanOrEqual(p * 2 + 1);
		expect(v).toBeGreaterThanOrEqual(p * 2 - 1);
		expect(v).toBeLessThanOrEqual(p * 2 + 1);
		// Parent keeps a visibly non-zero slot and renders the muted placeholder.
		expect(p).toBeGreaterThan(4);
		const body = spans.lines
			.map((l) => l.spans.map((s) => s.text).join(""))
			.join("\n");
		expect(body).toContain("—");
		expect(body).toContain("ITEM");
	});

	test("keeps the 1/5 parent slot across widths (ratio stable)", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>x</text>,
			preview: null,
			width: 70,
		});
		cleanups.push(destroy);
		const [p, c, v] = columnWidths(spans);
		expect(p).toBe(14); // 70 → 14 / 28 / 28
		expect(c).toBe(28);
		expect(v).toBe(28);
	});
});

// ── Integration: the accent border was removed — no border or highlight ────
describe("PaneRow focus ring (borderless)", () => {
	// The current column no longer carries a focus ring: whatever `focused`
	// resolves to, no pane renders a border or an accent color. `focused`
	// still gates scroll-following, but it must never surface a separator.
	const borderGlyphs = /[┌┐└┘─│]/;

	test("focused=true renders no borders and no accent ring", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			focused: true,
		});
		cleanups.push(destroy);

		expect(frameText(spans)).not.toMatch(borderGlyphs);
	});

	test("focused=false renders no borders and no accent ring", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			focused: false,
		});
		cleanups.push(destroy);

		expect(frameText(spans)).not.toMatch(borderGlyphs);
	});

	test("accepts an accessor for focused (reactive boolean)", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			focused: () => true,
		});
		cleanups.push(destroy);
		expect(frameText(spans)).not.toMatch(borderGlyphs);

		const { spans: spans2, destroy: destroy2 } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			focused: () => false,
		});
		cleanups.push(destroy2);
		expect(frameText(spans2)).not.toMatch(borderGlyphs);
	});

	test("defaults to focused (still borderless, no accent ring)", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
		});
		cleanups.push(destroy);
		expect(frameText(spans)).not.toMatch(borderGlyphs);
	});
});
