/**
 * Nested scroll behavior — the innermost scrollbox under the cursor wins.
 *
 * opentui bubbles wheel events up the renderable tree, so without a guard
 * every ancestor scrollbox scrolls in lockstep. This pins the fix from
 * `src/utils/nested-scroll.ts`: two nested scrollboxes (an inner one nested
 * inside an outer one, as a description pane sits inside a list pane) must
 * treat the wheel as owned by the innermost scrollbox under the cursor, and
 * only chain out to the outer one when the inner is at its boundary.
 */

import { describe, test, expect, afterAll } from "bun:test";
import { testRender } from "@opentui/solid";
import { installNestedScrollBehavior } from "../src/utils/nested-scroll";
import type { ScrollBoxRenderable } from "@opentui/core";

installNestedScrollBehavior();

type TestSetup = {
	renderOnce: () => Promise<void>;
	mockMouse: {
		scroll: (x: number, y: number, direction: "up" | "down") => Promise<void>;
	};
	renderer: { destroy: () => Promise<void> };
};

async function renderNested(): Promise<{
	setup: TestSetup;
	outer: () => ScrollBoxRenderable;
	inner: () => ScrollBoxRenderable;
	destroy: () => Promise<void>;
}> {
	let outer: ScrollBoxRenderable | undefined;
	let inner: ScrollBoxRenderable | undefined;
	const setup = (await testRender(
		() => (
			// Outer spans the full 25-row terminal; the inner scrollbox sits at
			// rows 3..12 (a top spacer above, a tall spacer below so the outer
			// has room to scroll). Inner holds 30 rows -> max scroll 20.
			<box flexDirection="column" width={60} height={25}>
				<scrollbox ref={(el: ScrollBoxRenderable) => (outer = el)} height="100%">
					<box height={3} />
					<scrollbox
						ref={(el: ScrollBoxRenderable) => (inner = el)}
						height={10}
						width="100%"
					>
						{Array.from({ length: 30 }, (_, i) => (
							<box height={1}>
								<text>row {i}</text>
							</box>
						))}
					</scrollbox>
					<box height={40} />
				</scrollbox>
			</box>
		),
		{ width: 60, height: 25, useThread: false },
	)) as unknown as TestSetup;

	// Give the renderer a chance to compute scrollbox layout (scrollHeight).
	for (let i = 0; i < 40 && (inner?.scrollHeight ?? 0) <= 10; i++) {
		await setup.renderOnce();
		const { promise, resolve } = Promise.withResolvers<void>();
		setTimeout(resolve, 50);
		await promise;
	}
	if (!inner || !outer) throw new Error("scrollboxes did not render");
	return {
		setup,
		outer: () => outer!,
		inner: () => inner!,
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

describe("nested scroll favors the innermost scrollbox under the cursor", () => {
	test("wheel over the inner section scrolls only the inner scrollbox", async () => {
		const { setup, inner, outer, destroy } = await renderNested();
		cleanups.push(destroy);
		expect(inner().scrollTop).toBe(0);
		await setup.mockMouse.scroll(5, 5, "down"); // inside inner (rows 3..12)
		expect(inner().scrollTop).toBe(1);
		expect(outer().scrollTop).toBe(0);
	});

	test("wheel over the outer section (outside the inner) scrolls only the outer", async () => {
		const { setup, inner, outer, destroy } = await renderNested();
		cleanups.push(destroy);
		await setup.mockMouse.scroll(5, 20, "down"); // below inner, still in outer
		expect(outer().scrollTop).toBe(1);
		expect(inner().scrollTop).toBe(0);
	});

	test("at the inner's bottom edge the wheel chains out to the outer scrollbox", async () => {
		const { setup, inner, outer, destroy } = await renderNested();
		cleanups.push(destroy);
		for (let i = 0; i < 30; i++) await setup.mockMouse.scroll(5, 5, "down");
		expect(inner().scrollTop).toBe(20); // pinned at max (30 rows - 10 viewport)
		const before = outer().scrollTop;
		await setup.mockMouse.scroll(5, 5, "down");
		expect(inner().scrollTop).toBe(20); // inner stays pinned
		expect(outer().scrollTop).toBe(before + 1); // outer took over
	});

	test("wheel up favors the inner again once it has room above", async () => {
		const { setup, inner, outer, destroy } = await renderNested();
		cleanups.push(destroy);
		await setup.mockMouse.scroll(5, 5, "down");
		expect(inner().scrollTop).toBe(1);
		await setup.mockMouse.scroll(5, 5, "up");
		expect(inner().scrollTop).toBe(0); // inner wins again
		expect(outer().scrollTop).toBe(0);
	});
});
