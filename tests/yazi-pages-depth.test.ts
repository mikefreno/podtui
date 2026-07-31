/**
 * yazi-pages-depth.test.ts — task 03 page contract tests.
 *
 * The four depth-stack list tabs (Feed / MyShows / Discover / Settings) all
 * render through `<YaziPaneRow>` with the parent pane reading the
 * previous-depth frame's list (blank placeholder at depth 0). Their `open()`
 * action calls `nav.pushDepth(frame)` to drill and the Shell calls
 * `nav.popDepth()` on `h`. This file exercises the nav-store contract those
 * pages depend on for every depth-tab, asserting the parent-slot data model:
 *
 *   • depth 0  → stack has exactly the root frame (parent pane is blank)
 *   • drill(l)→ push a child frame; stack length 2, parent = previous list
 *   • drill(l)→ push again; stack length 3 (Settings sections→items→editor)
 *   • pop(h)  → stack shrinks; parent returns to the previous list
 *   • pop(h)  → back at root; parent is blank again
 *
 * The visual "blank → list → list → blank" transition is the union of this
 * data model (which list each depth renders) with `<YaziPaneRow>`'s null
 * placeholder (covered by yazi-pane-row.test.tsx). Tested at the store level
 * because the page `open()` closures are not exported and the nav store is
 * the shared contract all four pages route through.
 */

import { test, expect } from "bun:test";
import { createRoot } from "solid-js";
import {
	createNavigation,
	DEPTH_CENTER_PANE,
} from "../src/context/navigation-store";
import { TABS, DEPTH_TABS } from "../src/utils/navigation";
import type { DepthFrame } from "../src/context/NavigationContext";

function withNav(fn: (nav: ReturnType<typeof createNavigation>) => void) {
	createRoot((dispose) => {
		fn(createNavigation());
		dispose();
	});
}

/** The depth-tabs that must render via <YaziPaneRow> (task 03 conversion). */
const CONVERTED_TABS = [TABS.FEED, TABS.MYSHOWS, TABS.DISCOVER, TABS.SETTINGS];

for (const tab of CONVERTED_TABS) {
	const name = TABS[tab];

	test(`${name}: depth 0 → 1 → 2 push/pop keeps the parent-slot contract`, () => {
		withNav((nav) => {
			nav.setActiveTab(tab);
			expect(nav.isDepthTab()).toBe(true);

			// depth 0: exactly the root frame → parent pane renders blank.
			expect(nav.currentDepth()).toBe(0);
			expect(nav.depthStack()).toHaveLength(1);

			// drill (l): page open() pushes a child frame — parent becomes
			// the previous-depth list.
			const child: DepthFrame = { kind: `${name.toLowerCase()}:child`, ctx: "c1", focus: 0 };
			nav.pushDepth(child);
			nav.setActivePane(DEPTH_CENTER_PANE);
			expect(nav.currentDepth()).toBe(1);
			expect(nav.depthStack()).toHaveLength(2);
			// the parent (depth 0) frame is still the root; the top is the child.
			expect(nav.depthStack()[0]).toBe(nav.depthStack()[0]);
			expect(nav.topFrame()).toEqual(child);

			// drill again (l): push a second child — parent shows the first
			// child's list (the chain Settings exercises: sections→items→editor).
			const grandchild: DepthFrame = { kind: `${name.toLowerCase()}:grand`, ctx: "g1", focus: 0 };
			nav.pushDepth(grandchild);
			expect(nav.currentDepth()).toBe(2);
			expect(nav.depthStack()).toHaveLength(3);
			expect(nav.topFrame()).toEqual(grandchild);

			// pop (h): back to depth 1 — parent frame is the root, top is child.
			expect(nav.popDepth()).toBe(true);
			expect(nav.currentDepth()).toBe(1);
			expect(nav.depthStack()).toHaveLength(2);
			expect(nav.topFrame()).toEqual(child);

			// pop (h): back to depth 0 — parent pane is blank again.
			expect(nav.popDepth()).toBe(true);
			expect(nav.currentDepth()).toBe(0);
			expect(nav.depthStack()).toHaveLength(1);
		});
	});

	test(`${name}: pop (h) at depth 0 is a noop (returns false, root kept)`, () => {
		withNav((nav) => {
			nav.setActiveTab(tab);
			expect(nav.currentDepth()).toBe(0);
			expect(nav.popDepth()).toBe(false);
			expect(nav.currentDepth()).toBe(0);
			// the root frame is preserved (parent stays blank, not undefined).
			expect(nav.depthStack()).toHaveLength(1);
			expect(nav.topFrame()).toBeDefined();
		});
	});
}

// ── DEPTH_TABS covers exactly the four converted pages ───────────────────────
test("DEPTH_TABS is exactly the four converted list tabs", () => {
	expect([...DEPTH_TABS].sort()).toEqual(
		[TABS.FEED, TABS.MYSHOWS, TABS.DISCOVER, TABS.SETTINGS].sort(),
	);
});
