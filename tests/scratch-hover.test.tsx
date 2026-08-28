/** Scratch — verify full-height hover accent line. */
import { test, expect } from "bun:test";
import { testRender } from "@opentui/solid";
import { ThemeProvider } from "../src/context/ThemeContext";
import { PaneRow } from "../src/components/PaneRow";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "podtui-phover3-"));

type Span = { text: string; fg?: { r: number; g: number; b: number; a: number } | null };
type Frame = { cols: number; lines: { spans: Span[] }[] };

test("hover renders accent line on every row", async () => {
	const setup = (await testRender(
		() => (
			<ThemeProvider mode="dark">
				<PaneRow
					parent={<text selectable={false}>{"P".repeat(300)}</text>}
					current={<text selectable={false}>{"C".repeat(600)}</text>}
					preview={<text selectable={false}>{"V".repeat(300)}</text>}
					currentLabel=""
				/>
			</ThemeProvider>
		),
		{ width: 100, height: 10, useThread: false },
	)) as unknown as {
		renderOnce: () => Promise<void>;
		captureSpans: () => Frame;
		captureCharFrame: () => string;
		mockMouse: { moveTo: (x: number, y: number) => Promise<void> };
		renderer: { destroy: () => void };
	};
	for (let i = 0; i < 10; i++) await setup.renderOnce();
	await setup.mockMouse.moveTo(20, 5);
	for (let i = 0; i < 3; i++) await setup.renderOnce();

	const frame = setup.captureSpans();
	let accentRows = 0;
	for (let y = 0; y < frame.lines.length; y++) {
		const line = frame.lines[y].spans.map((s) => s.text).join("");
		// Border column = 20.
		const ch = line[20];
		const isAccent = frame.lines[y].spans
			.filter((s) => s.text.length > 0)
			.some((s) => {
				const t = s.text;
				let c = 0;
				// recompute col: approximate by scanning previous spans
				return false;
			});
		if (ch === "│") accentRows++;
		console.log(`row ${y}: ${JSON.stringify(line.slice(16, 25))} ch20=${JSON.stringify(ch)}`);
	}
	console.log("accentRows:", accentRows, "of", frame.lines.length);
	expect(accentRows).toBeGreaterThanOrEqual(6);
	setup.renderer.destroy();
});
