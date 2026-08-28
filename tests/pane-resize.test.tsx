/**
 * pane-resize.test.tsx — dragging the center column's borders actually
 * resizes the panes in a rendered PaneRow.
 *
 * Each pane renders a long run of a unique character (P / C / V). A line
 * where all three meet encodes the boundary columns directly: the current
 * pane carries the only borders (cols `leftPx` and `rightPx - 1`), so its
 * content starts one column in — `leftPx + 1`. Hence
 * `leftPx = firstC - 1`, `rightPx = firstV`.
 *
 * The drag strips overlay the border cells (left strip at [left, left+2),
 * right strip at [right-2, right)). The test presses inside a strip and
 * drags across the row — the drag bubbles to the row container which moves
 * the split, so the panes must re-render at the new columns.
 */
import { test, expect, afterAll } from "bun:test";
import { testRender } from "@opentui/solid";
import { ThemeProvider } from "../src/context/ThemeContext";
import { PaneRow } from "../src/components/PaneRow";
import { usePaneLayout } from "../src/stores/pane-layout";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the config dir at a throwaway directory BEFORE importing the store
// (module-level init reads it).
const configHome = mkdtempSync(join(tmpdir(), "podtui-paneresize-"));
process.env.XDG_CONFIG_HOME = configHome;

type Span = { text: string };
type Frame = { cols: number; lines: { spans: Span[] }[] };

interface BoundCols {
	left: number;
	right: number;
}

function readBounds(frame: Frame): BoundCols {
	const line = frame.lines
		.map((l) => l.spans.map((s) => s.text).join(""))
		.find((l) => l.includes("C"));
	if (!line) throw new Error("pane row did not render");
	return { left: line.indexOf("C") - 1, right: line.indexOf("V") };
}

async function renderRow(panes: 2 | 3 = 3) {
	const setup = (await testRender(
		() => (
			<ThemeProvider mode="dark">
				<PaneRow
					parent={<text selectable={false}>{"P".repeat(300)}</text>}
					current={<text selectable={false}>{"C".repeat(600)}</text>}
					preview={<text selectable={false}>{"V".repeat(300)}</text>}
					currentLabel=""
					panes={panes}
				/>
			</ThemeProvider>
		),
		{ width: 100, height: 10, useThread: false },
	)) as unknown as {
		renderOnce: () => Promise<void>;
		captureSpans: () => Frame;
		mockMouse: {
			drag: (a: number, b: number, c: number, d: number) => Promise<void>;
			click: (a: number, b: number) => Promise<void>;
		};
		renderer: { destroy: () => void };
	};
	for (let i = 0; i < 10; i++) await setup.renderOnce();
	return setup;
}

/** Reset the shared store to the default split for a deterministic start. */
function resetSplits() {
	usePaneLayout().setLeft(20, 100);
	usePaneLayout().setRight(70, 100);
}

const cleanups: (() => void)[] = [];
afterAll(() => {
	for (const c of cleanups) c();
	// Restore the default split so a later file sharing this process (bun
	// test reuses the module registry) renders the default layout.
	usePaneLayout().setLeft(20, 100);
	usePaneLayout().setRight(70, 100);
	rmSync(configHome, { recursive: true, force: true });
});

test("panes render at the default 20/70 split", async () => {
	const setup = await renderRow(3);
	cleanups.push(() => setup.renderer.destroy());
	resetSplits();
	await setup.renderOnce();
	const { left, right } = readBounds(setup.captureSpans());
	expect(left).toBe(20);
	expect(right).toBe(70);
});

test("dragging the left border resizes parent vs current", async () => {
	const setup = await renderRow(3);
	cleanups.push(() => setup.renderer.destroy());
	resetSplits();
	await setup.renderOnce();

	// Press on the left strip (border at 20 → strip covers 20) and drag
	// toward the middle of the row.
	await setup.mockMouse.drag(20, 5, 45, 5);
	for (let i = 0; i < 10; i++) await setup.renderOnce();
	const after = readBounds(setup.captureSpans());
	expect(after.left).toBeGreaterThanOrEqual(44);
	expect(after.left).toBeLessThanOrEqual(46);
	// Pushing the left border to 45 would shrink the current pane below its
	// 30-col minimum (45..70 = 25), so the right border is forced right to
	// 75, keeping the current pane at exactly 30 and absorbing the overflow
	// in the preview.
	expect(after.right).toBe(75);
});

test("dragging the right border resizes current vs preview", async () => {
	const setup = await renderRow(3);
	cleanups.push(() => setup.renderer.destroy());
	resetSplits();
	await setup.renderOnce();

	// Press on the right strip (border at 69 → strip covers 69) and drag
	// toward the right edge of the row.
	await setup.mockMouse.drag(69, 5, 90, 5);
	for (let i = 0; i < 10; i++) await setup.renderOnce();
	const after = readBounds(setup.captureSpans());
	expect(after.right).toBeGreaterThanOrEqual(84);
	expect(after.right).toBeLessThanOrEqual(85); // clamped at preview min 15
	expect(after.left).toBe(20);
});

test("a plain click away from the borders does not resize", async () => {
	const setup = await renderRow(3);
	cleanups.push(() => setup.renderer.destroy());
	resetSplits();
	await setup.renderOnce();

	await setup.mockMouse.click(5, 5);
	await setup.renderOnce();
	const { left, right } = readBounds(setup.captureSpans());
	expect(left).toBe(20);
	expect(right).toBe(70);
});

test("2-pane rows offer no right border (current fills the row)", async () => {
	const setup = await renderRow(2);
	cleanups.push(() => setup.renderer.destroy());
	resetSplits();
	for (let i = 0; i < 10; i++) await setup.renderOnce();

	// No 'V' pane: the line runs to the screen edge.
	const frame = setup.captureSpans();
	const { left } = readBounds(frame);
	expect(left).toBe(20);
	const line = frame.lines
		.map((l) => l.spans.map((s) => s.text).join(""))
		.find((l) => l.includes("C"));
	expect(line?.includes("V")).toBe(false);
});
