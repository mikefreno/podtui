/**
 * Show-row height regression — My Shows depth-0 rows must stay exactly one
 * line tall: marker + show title + episode count (+ watchlist dot). The
 * flexible title carries `wrapMode="none"` + `truncate` (middle-ellipsis:
 * head and tail of the title stay visible) and the fixed-width cells carry
 * `flexShrink={0}`, so Yoga can never shrink them and wrap the row — a
 * wrapped row grows to 2+ lines and the episode count + watchlist dot shift
 * below the title while scrolling (the original bug). Same guard for the
 * 20%-wide parent-pane shows list at depth ≥1.
 *
 * Rendered at 70 columns so the 35-col current pane / 14-col parent pane are
 * narrow enough to force truncation on the long title; at the default
 * 100-col/50-col pane the same rows show everything in full.
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

const LONG_TITLE =
	"Out of Whiskey and Reaching for the Rotgut (Members Only #338)";

// The exact depth-0 row shape MyShowsPage renders: marker + title + count +
// watchlist dot. Static text, no store hooks — pure layout probe.
const ShowRowFixed = () => (
	<box flexDirection="row" gap={1} paddingRight={1}>
		<text flexShrink={0}>❯</text>
		<text wrapMode="none" truncate>
			{LONG_TITLE}
		</text>
		<text flexShrink={0}>(123)</text>
		<text flexShrink={0}>●</text>
	</box>
);

// Pre-fix shape: no wrapMode/truncate/flexShrink props — the long title
// wraps at the shrunken width and pushes the count + dot onto wrapped lines.
const ShowRowNaive = () => (
	<box flexDirection="row" gap={1} paddingRight={1}>
		<text>❯</text>
		<text>{LONG_TITLE}</text>
		<text>(123)</text>
		<text>●</text>
	</box>
);

// The depth-1 parent-pane shows-list row (marker + title + count).
const ParentRowFixed = () => (
	<box flexDirection="row" gap={1} paddingRight={1}>
		<text flexShrink={0}>❯</text>
		<text wrapMode="none" truncate>
			{LONG_TITLE}
		</text>
		<text flexShrink={0}>(123)</text>
	</box>
);

const ParentRowNaive = () => (
	<box flexDirection="row" gap={1} paddingRight={1}>
		<text>❯</text>
		<text>{LONG_TITLE}</text>
		<text>(123)</text>
	</box>
);

async function renderRow(
	row: () => JSX.Element,
	pane: "current" | "parent",
	width = 70,
): Promise<{ lines: string[]; destroy: () => Promise<void> }> {
	const setup = await testRender(
		() => (
			<ThemeProvider mode="dark">
				<PaneRow
					parent={pane === "parent" ? row : null}
					current={pane === "current" ? row : null}
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

describe("show row height in the current pane (70-wide → 35-col pane)", () => {
	test("long title stays on one line — middle-ellipsis keeps head AND tail, count + dot stay aligned", async () => {
		const { lines, destroy } = await renderRow(ShowRowFixed, "current");
		cleanups.push(destroy);

		// Middle-ellipsis: the title head and its tail both survive, on a
		// single line (end-truncation would drop the tail).
		expect(lines.filter((l) => l.includes("Out of Wh"))).toHaveLength(1);
		expect(lines.filter((l) => l.includes("#338)"))).toHaveLength(1);
		// The count and watchlist dot sit on that same line — nothing wrapped.
		const aligned = lines.filter(
			(l) =>
				l.includes("Out of Wh") &&
				l.includes("#338)") &&
				l.includes("(123)") &&
				l.includes("●"),
		);
		expect(aligned).toHaveLength(1);
		// Row occupies exactly 1 content line below the header.
		const content = lines.filter(
			(l) => l.includes("Out of Wh") || l.includes("(123)"),
		);
		expect(content).toHaveLength(1);
	});

	test("naive row (pre-fix props) wraps the title — the regression the test guards", async () => {
		const { lines, destroy } = await renderRow(ShowRowNaive, "current");
		cleanups.push(destroy);

		// The title's wrapped fragments span 3 frame lines instead of 1 —
		// every row below shifts while scrolling.
		const titleFragments = lines.filter(
			(l) =>
				l.includes("Out of Whiskey") ||
				l.includes("Rotgut") ||
				l.includes("#338)"),
		);
		expect(titleFragments).toHaveLength(3);
	});
});

describe("show row in the parent pane (70-wide → 14-col pane)", () => {
	test("long title stays on one line with count aligned", async () => {
		const { lines, destroy } = await renderRow(ParentRowFixed, "parent");
		cleanups.push(destroy);

		// The 14-col slot truncates the title to a head stub (too narrow for
		// head + tail), but the row stays one line and the count pins to it.
		expect(lines.filter((l) => l.includes("O..."))).toHaveLength(1);
		expect(
			lines.filter((l) => l.includes("O...") && l.includes("(123)")),
		).toHaveLength(1);
	});

	test("naive parent row wraps the title — the regression the test guards", async () => {
		const { lines, destroy } = await renderRow(ParentRowNaive, "parent");
		cleanups.push(destroy);

		const titleFragments = lines.filter(
			(l) =>
				l.includes("Out of") ||
				l.includes("Whiskey") ||
				l.includes("Rotgut") ||
				l.includes("#3"),
		);
		expect(titleFragments.length).toBeGreaterThan(1);
	});
});
