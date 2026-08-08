/**
 * PaneRow tests — the 1:3:3 parent|current|preview layout primitive.
 *
 * Verified through the opentui test renderer's captured frames (the same
 * mechanism the `.harness` drive uses), since `flexGrow` ratios are only
 * observable as rendered column widths and border colors.
 *
 *  • Unit: three columns render at 1:3:3 (e.g. 14/43/43 of 100) even when the
 *    parent and preview children are null, and the blank parent keeps its
 *    slot with a muted placeholder.
 *  • Integration: toggling `focused` moves the accent focus ring onto/off the
 *    current column; parent & preview borders stay muted either way.
 *
 * Runs via `bun test`. The `[test] preload = "@opentui/solid/preload"` entry
 * in bunfig.toml registers the solid JSX transform for the test runner, so
 * JSX in this file compiles exactly like app code.
 */

import { describe, test, expect, afterAll } from "bun:test";
import { testRender } from "@opentui/solid";
import { ThemeProvider } from "../src/context/ThemeContext";
import { PaneRow } from "../src/components/PaneRow";

type Span = { text: string; fg: { buffer: ArrayLike<number> } | null };
type Frame = { lines: { spans: Span[] }[] };

// ── Frame introspection helpers ─────────────────────────────────────────────
function hexOf(fg: Span["fg"]): string | null {
	if (!fg?.buffer) return null;
	const b = fg.buffer;
	if (b[3] === 0) return null;
	return (
		"#" +
		[0, 1, 2]
			.map((i) =>
				Math.max(0, Math.min(255, Math.round(b[i] * 255)))
					.toString(16)
					.padStart(2, "0"),
			)
			.join("")
	);
}

/** Column border colors, scanned from the top border row (`┌───┐…`). */
function columnBorders(spans: Frame): string[] {
	const line = spans.lines[1];
	if (!line) return [];
	const out: string[] = [];
	for (const sp of line.spans) {
		for (const ch of sp.text) {
			if (ch === "┌") out.push(hexOf(sp.fg) ?? "default");
		}
	}
	return out;
}

/** Column widths (including borders), from the top border row. */
function columnWidths(spans: Frame): number[] {
	const line = spans.lines[1];
	if (!line) return [];
	const widths: number[] = [];
	for (const sp of line.spans) {
		for (const ch of sp.text) {
			if (ch === "┌") widths.push(0);
			else if (widths.length && ch === "─") widths[widths.length - 1]++;
			else if (widths.length && ch === "┐") widths[widths.length - 1] += 2;
		}
	}
	return widths;
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
	for (let i = 0; i < 6; i++) {
		await setup.renderOnce();
		await new Promise((r) => setTimeout(r, 40));
	}
	const spans = setup.captureSpans() as unknown as Frame;
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

// ── Unit: three columns at 1:3:3 regardless of null children ───────────────
describe("PaneRow layout", () => {
	test("renders three columns at 1:3:3 even with null parent/preview", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
		});
		cleanups.push(destroy);

		const widths = columnWidths(spans);
		expect(widths).toHaveLength(3);
		const [p, c, v] = widths;
		// 100-wide row splits as 14 / 43 / 43 (1/7 : 3/7 : 3/7, borders included).
		expect(p).toBe(14);
		expect(c).toBe(43);
		expect(v).toBe(43);
		// Exact 1:3:3 proportion (within 1 col rounding).
		expect(c).toBeGreaterThanOrEqual(p * 3 - 1);
		expect(c).toBeLessThanOrEqual(p * 3 + 1);
		expect(v).toBeGreaterThanOrEqual(p * 3 - 1);
		expect(v).toBeLessThanOrEqual(p * 3 + 1);
		// Parent keeps a visibly non-zero slot and renders the muted placeholder.
		expect(p).toBeGreaterThan(4);
		const body = spans.lines
			.map((l) => l.spans.map((s) => s.text).join(""))
			.join("\n");
		expect(body).toContain("—");
		expect(body).toContain("ITEM");
	});

	test("keeps the 1/7 parent slot across widths (ratio stable)", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>x</text>,
			preview: null,
			width: 70,
		});
		cleanups.push(destroy);
		const [p, c, v] = columnWidths(spans);
		expect(p).toBe(10); // 70 → 10 / 30 / 30
		expect(c).toBe(30);
		expect(v).toBe(30);
	});
});

// ── Integration: focused toggles the accent ring on the current column ─────
describe("PaneRow focus ring", () => {
	test("focused=true puts the accent border on current; parent/preview stay muted", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			focused: true,
		});
		cleanups.push(destroy);

		const [parent, current, preview] = columnBorders(spans);
		// parent & preview are muted; current is the (different) accent color.
		expect(parent).toBe(preview);
		expect(current).not.toBe(parent);
		expect(current).not.toBe("default");
	});

	test("focused=false mutes the current column (no accent ring anywhere)", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			focused: false,
		});
		cleanups.push(destroy);

		const [parent, current, preview] = columnBorders(spans);
		expect(current).toBe(parent);
		expect(preview).toBe(parent);
	});

	test("accepts an accessor for focused (reactive boolean)", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			focused: () => true,
		});
		cleanups.push(destroy);

		const [parent, current] = columnBorders(spans);
		expect(current).not.toBe(parent); // accessor resolves true → accent ring

		const { spans: spans2, destroy: destroy2 } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
			focused: () => false,
		});
		cleanups.push(destroy2);
		const [p2, c2] = columnBorders(spans2);
		expect(c2).toBe(p2); // accessor resolves false → muted
	});

	test("defaults to focused (current column carries the accent ring)", async () => {
		const { spans, destroy } = await renderPaneRow({
			parent: null,
			current: () => <text>ITEM</text>,
			preview: null,
		});
		cleanups.push(destroy);
		const [parent, current] = columnBorders(spans);
		expect(current).not.toBe(parent);
	});
});
