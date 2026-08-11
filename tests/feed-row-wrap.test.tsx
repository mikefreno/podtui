/**
 * Episode-row height regression — Feed rows must stay exactly 3 lines tall:
 * title, podcast name, meta (date + duration + markers). Every line carries
 * `wrapMode="none"` + `truncate` on flexible text and `flexShrink={0}` on
 * fixed-width cells so Yoga can never shrink a text below its content width
 * and wrap it — a wrapped row grows to 4+ lines and every entry below
 * shifts its starting position while scrolling (the original bug).
 *
 * Rendered at 70 columns so the 35-col current pane is narrow enough to
 * force truncation on the long title; at the default 100-col/50-col pane
 * the same rows show everything in full.
 */

import { describe, test, expect, afterAll } from "bun:test";
import type { JSX } from "solid-js";
import { testRender } from "@opentui/solid";
import { ThemeProvider } from "../src/context/ThemeContext";
import { PaneRow } from "../src/components/PaneRow";

type Frame = { cols: number; lines: { spans: { text: string }[] }[] };

function frameText(spans: Frame): string[] {
	return spans.lines.map((l) => l.spans.map((s) => s.text).join(""));
}

// The exact row shape FeedPage renders: title, podcast name, meta. Static
// text, no store hooks — pure layout probe.
const FixedRow = () => (
	<box flexDirection="column" gap={0} paddingLeft={1} paddingRight={1}>
		<box flexDirection="row" gap={1}>
			<text flexShrink={0}>❯</text>
			<text wrapMode="none" truncate>
				#674 - Scott Payne
			</text>
		</box>
		<box paddingLeft={2}>
			<text wrapMode="none" truncate>
				This Past Weekend w/ Theo Von
			</text>
		</box>
		<box flexDirection="row" gap={2} paddingLeft={2}>
			<text flexShrink={0}>Aug 10, 2026</text>
			<text flexShrink={0}>3h 50m</text>
		</box>
	</box>
);

// A long title proves the truncate guard: without it the title wraps to
// multiple lines and the row grows past 3 lines.
const LongTitleFixed = () => (
	<box flexDirection="column" gap={0} paddingLeft={1} paddingRight={1}>
		<box flexDirection="row" gap={1}>
			<text flexShrink={0}>❯</text>
			<text wrapMode="none" truncate>
				Out of Whiskey and Reaching for the Rotgut (Members Only #338)
			</text>
		</box>
		<box paddingLeft={2}>
			<text wrapMode="none" truncate>
				This Past Weekend w/ Theo Von
			</text>
		</box>
		<box flexDirection="row" gap={2} paddingLeft={2}>
			<text flexShrink={0}>Aug 10, 2026</text>
			<text flexShrink={0}>3h 50m</text>
		</box>
	</box>
);

// Pre-fix shape: no wrapMode/truncate/flexShrink props — the long title
// wraps at the shrunken width and the row grows.
const NaiveRow = () => (
	<box flexDirection="column" gap={0} paddingLeft={1} paddingRight={1}>
		<box flexDirection="row" gap={1}>
			<text>❯</text>
			<text>Out of Whiskey and Reaching for the Rotgut (Members Only #338)</text>
		</box>
		<box paddingLeft={2}>
			<text>This Past Weekend w/ Theo Von</text>
		</box>
		<box flexDirection="row" gap={2} paddingLeft={2}>
			<text>Aug 10, 2026</text>
			<text>3h 50m</text>
		</box>
	</box>
);

async function renderCurrent(
	row: () => JSX.Element,
	width = 70,
): Promise<{ lines: string[]; destroy: () => Promise<void> }> {
	const setup = await testRender(
		() => (
			<ThemeProvider mode="dark">
				<PaneRow
					parent={null}
					current={row}
					preview={null}
					currentLabel="List"
				/>
			</ThemeProvider>
		),
		{ width, height: 10, useThread: false },
	);
	// ThemeProvider mounts children only once the theme resolves; poll for
	// the header row so the captured frame is a mounted PaneRow.
	let lines: string[] | null = null;
	for (let i = 0; i < 40 && !lines; i++) {
		await setup.renderOnce();
		const frame = setup.captureSpans() as unknown as Frame;
		const ls = frameText(frame);
		if (ls.some((l) => l.includes("List"))) lines = ls;
		else await new Promise((r) => setTimeout(r, 100));
	}
	if (!lines) throw new Error("PaneRow did not render before timeout");
	return {
		lines,
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

describe("episode row height in the current pane (70-wide → 35-col pane)", () => {
	test("fixed row: title, podcast name and meta each render on exactly one line", async () => {
		const { lines, destroy } = await renderCurrent(() => <FixedRow />);
		cleanups.push(destroy);

		// Podcast name is fully visible on its own line — the usability the
		// dedicated row exists for.
		expect(lines.filter((l) => l.includes("This Past Weekend w/ Theo Von"))).toHaveLength(1);
		// Title and meta each on a single frame line (a wrapped date would
		// split "Aug 10, 2026" across lines).
		expect(lines.filter((l) => l.includes("Scott Payne"))).toHaveLength(1);
		expect(lines.filter((l) => l.includes("Aug 10, 2026"))).toHaveLength(1);
		expect(lines.filter((l) => l.includes("3h 50m"))).toHaveLength(1);
		// The row occupies exactly the 3 content lines below the header.
		const content = lines.filter(
			(l) =>
				l.includes("Scott Payne") ||
				l.includes("This Past Weekend") ||
				l.includes("Aug 10,"),
		);
		expect(content).toHaveLength(3);
	});

	test("long title stays on one line (truncated), keeping the row at 3 lines", async () => {
		const { lines, destroy } = await renderCurrent(() => <LongTitleFixed />);
		cleanups.push(destroy);

		// Truncated: the title head appears on exactly one line and the full
		// title never appears on any line (middle-ellipsis clips it).
		expect(lines.filter((l) => l.includes("Out of Whiske"))).toHaveLength(1);
		expect(
			lines.some((l) =>
				l.includes(
					"Out of Whiskey and Reaching for the Rotgut (Members Only #338)",
				),
			),
		).toBe(false);
		// Podcast name and meta still each on one line — row total 3.
		expect(lines.filter((l) => l.includes("This Past Weekend"))).toHaveLength(1);
		expect(lines.filter((l) => l.includes("Aug 10,"))).toHaveLength(1);
		const content = lines.filter(
			(l) =>
				l.includes("Out of Whiske") ||
				l.includes("This Past Weekend") ||
				l.includes("Aug 10,"),
		);
		expect(content).toHaveLength(3);
	});

	test("naive row (pre-fix props) wraps the long title — the regression the test guards", async () => {
		const { lines, destroy } = await renderCurrent(() => <NaiveRow />);
		cleanups.push(destroy);

		// The title's wrapped fragments span 3 frame lines instead of 1.
		const titleFragments = lines.filter(
			(l) =>
				l.includes("Out of Whiske") ||
				l.includes("for the Rotgut") ||
				l.includes("#338)"),
		);
		expect(titleFragments).toHaveLength(3);
		// Row total: 3 title lines + podcast + meta = 5 content lines.
		const content = lines.filter(
			(l) =>
				l.includes("Out of Whiske") ||
				l.includes("for the Rotgut") ||
				l.includes("#338)") ||
				l.includes("This Past Weekend") ||
				l.includes("Aug 10,"),
		);
		expect(content).toHaveLength(5);
	});
});
