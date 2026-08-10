/**
 * ProgressBar click-to-seek test — pins the mouse→seek coordinate mapping.
 *
 * @opentui MouseEvent.x/y are terminal-absolute (the SGR parser returns
 * `col - 1` and the event propagates up the renderable tree unchanged),
 * NOT element-relative. The bar must subtract its own absolute left edge
 * (read from the renderable ref) or every click lands shifted by the panes
 * to its left — the parent/Up pane ≈ 20% of the terminal width. The bar is
 * rendered here exactly as PlayerPage renders it (2-pane PaneRow, padded
 * column), so the terminal geometry matches production.
 */

import { describe, test, expect, afterAll, mock } from "bun:test";
import { testRender } from "@opentui/solid";
import { ThemeProvider } from "../src/context/ThemeContext";
import { PaneRow } from "../src/components/PaneRow";
import { ProgressBar } from "../src/pages/Player/ProgressBar";

// ── Audio stub ─────────────────────────────────────────────────────────

const seeks: number[] = [];
const fakeAudio = {
	duration: () => 100,
	position: () => 0,
	seek: async (seconds: number) => {
		seeks.push(seconds);
	},
};

mock.module("../src/hooks/useAudio", () => ({
	useAudio: () => fakeAudio,
}));

// ── Harness ───────────────────────────────────────────────────────────

type Span = { text: string };
type Frame = { cols: number; lines: { spans: Span[] }[] };
type TestSetup = {
	renderOnce: () => Promise<void>;
	captureSpans: () => unknown;
	mockMouse: { click: (x: number, y: number) => Promise<void> };
	renderer: { destroy: () => Promise<void> };
};

interface BarGeometry {
	setup: TestSetup;
	/** Terminal column of the first rendered ░ (the bar's played/remaining run). */
	runStartX: number;
	/** Number of ░ glyphs drawn (the bar's content width). */
	contentWidth: number;
	/** Terminal row of the bar's content line. */
	barY: number;
	destroy: () => Promise<void>;
}

async function renderBar(): Promise<BarGeometry> {
	const setup = (await testRender(
		() => (
			<ThemeProvider mode="dark">
				<PaneRow
					parent={null}
					current={() => (
						<box flexDirection="column" gap={1} padding={1}>
							<ProgressBar />
						</box>
					)}
					currentLabel="Player"
					panes={2}
				/>
			</ThemeProvider>
		),
		{ width: 100, height: 10, useThread: false },
	)) as unknown as TestSetup;

	let runStartX = -1;
	let contentWidth = -1;
	let barY = -1;
	for (let i = 0; i < 40; i++) {
		await setup.renderOnce();
		const frame = setup.captureSpans() as unknown as Frame;
		const lines = frame.lines.map((l) => l.spans.map((s) => s.text).join(""));
		const line = lines.find((l) => l.includes("░"));
		if (line) {
			barY = lines.indexOf(line);
			runStartX = line.indexOf("░");
			contentWidth = line.split("░").length - 1;
			break;
		}
		const { promise, resolve } = Promise.withResolvers<void>();
		setTimeout(resolve, 100);
		await promise;
	}
	if (barY < 0) throw new Error("ProgressBar did not render before timeout");

	return {
		setup,
		runStartX,
		contentWidth,
		barY,
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

// ── Click-to-seek ──────────────────────────────────────────────────────

describe("ProgressBar click-to-seek", () => {
	test("the bar sits past the parent pane (test premise)", async () => {
		const bar = await renderBar();
		cleanups.push(bar.destroy);
		// Parent pane keeps its 20% slot: the bar's run must start well
		// right of column 0, otherwise the test would not reproduce the
		// coordinate-offset bug.
		expect(bar.runStartX).toBeGreaterThan(15);
	});

	test("clicking the first content column seeks near the start, not the parent pane offset", async () => {
		const bar = await renderBar();
		cleanups.push(bar.destroy);

		seeks.length = 0;
		// Pre-fix, the handler read the absolute mouse x as bar-local:
		// clicking the bar's left edge sought to ~20%+ of the duration
		// (the Up pane's width). It must now seek to the very start.
		await bar.setup.mockMouse.click(bar.runStartX, bar.barY);
		expect(seeks).toHaveLength(1);
		expect(seeks[0]).toBe(0);
	});

	test("clicking the bar's right edge seeks to the end", async () => {
		const bar = await renderBar();
		cleanups.push(bar.destroy);

		seeks.length = 0;
		// The column right of the last drawn char is the box's right border:
		// local x there equals the content width, so the seek must be 100%.
		await bar.setup.mockMouse.click(
			bar.runStartX + bar.contentWidth,
			bar.barY,
		);
		expect(seeks).toHaveLength(1);
		expect(seeks[0]).toBeCloseTo(100, 0);
	});

	test("clicking the bar's middle seeks to half the duration", async () => {
		const bar = await renderBar();
		cleanups.push(bar.destroy);

		seeks.length = 0;
		const mid = bar.runStartX + Math.floor(bar.contentWidth / 2);
		await bar.setup.mockMouse.click(mid, bar.barY);
		expect(seeks).toHaveLength(1);
		expect(seeks[0]).toBeCloseTo(50, 0);
	});

	test("clicks map linearly across the whole bar", async () => {
		const bar = await renderBar();
		cleanups.push(bar.destroy);

		seeks.length = 0;
		// One click at each drawn column; each must seek to that column's
		// exact share of the duration (within one second of rounding).
		for (let offset = 0; offset < bar.contentWidth; offset++) {
			await bar.setup.mockMouse.click(bar.runStartX + offset, bar.barY);
			const expected = (offset / bar.contentWidth) * 100;
			expect(seeks[seeks.length - 1]).toBeCloseTo(expected, 0);
		}
	});
});
