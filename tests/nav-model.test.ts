/**
 * nav-model.test.ts — yazi remake task 01 unit/integration tests.
 *
 * Covers the removal of the SIDEBAR_PANE concept:
 *   • createNavigation() exposes the nav factory directly (no Solid render
 *     needed), wrapped in a createRoot so effects register/dispose.
 *   • depth-tab focusedIndex depth-current read/writes the top frame's focus.
 *   • the tab-switch effect resets activePane to DEPTH_CENTER_PANE (0), not -1.
 *   • swipe() clamps to [0, paneCount-1] (no -1 sidebar slot).
 */
import { test, expect } from "bun:test";
import { createRoot } from "solid-js";
import {
	createNavigation,
	DEPTH_CENTER_PANE,
	NavMode,
} from "../src/context/navigation-store";
import { TABS, TabPaneCount } from "../src/utils/navigation";

/** Build a fresh nav graph inside a reactive root and run `fn` against it.
 *  Disposes the root afterwards so effects/signals don't leak between tests. */
function withNav(fn: (nav: ReturnType<typeof createNavigation>) => void) {
	createRoot((dispose) => {
		const nav = createNavigation();
		fn(nav);
		dispose();
	});
}

test("createNavigation initial activePane is DEPTH_CENTER_PANE (0), not -1", () => {
	withNav((nav) => {
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
		expect(nav.activePane()).toBe(0);
	});
});

// ── depth-tab focus: reads/writes the top frame's focus ───────────────────────
test("depth-tab focusedIndex(DEPTH_CENTER_PANE) returns top frame's focus", () => {
	withNav((nav) => {
		// FEED is a depth-tab; its root frame is { kind: "feeds", focus: 0 }.
		nav.setActiveTab(TABS.FEED);
		expect(nav.isDepthTab()).toBe(true);
		expect(nav.focusedIndex(DEPTH_CENTER_PANE)).toBe(0);
		// setFocusedIndex writes to the *top* frame, not a pane map.
		nav.setFocusedIndex(DEPTH_CENTER_PANE, 7);
		expect(nav.focusedIndex(DEPTH_CENTER_PANE)).toBe(7);
		// topFrame focus reflects the write.
		expect(nav.topFrame()?.focus).toBe(7);
	});
});

test("setFocusedIndex on a 2-frame stack writes only the top frame", () => {
	withNav((nav) => {
		nav.setActiveTab(TABS.FEED);
		// root frame focus 3, then push a child frame whose focus is 5.
		nav.setFocusedIndex(DEPTH_CENTER_PANE, 3);
		nav.pushDepth({ kind: "episodes:feedId", ctx: "f1", focus: 5 });
		expect(nav.currentDepth()).toBe(1);
		// writing the current pane updates only the top (child) frame.
		nav.setFocusedIndex(DEPTH_CENTER_PANE, 9);
		expect(nav.focusedIndex(DEPTH_CENTER_PANE)).toBe(9);
		// the previous depth's focus is untouched.
		expect(nav.depthFocus(0)).toBe(3);
		// popping restores the parent frame's focus.
		expect(nav.popDepth()).toBe(true);
		expect(nav.currentDepth()).toBe(0);
		expect(nav.focusedIndex(DEPTH_CENTER_PANE)).toBe(3);
	});
});

// ── popDepth is a noop at depth 0 ────────────────────────────────────────────
test("popDepth at depth 0 is a noop (returns false, no frame lost)", () => {
	withNav((nav) => {
		nav.setActiveTab(TABS.MYSHOWS);
		expect(nav.currentDepth()).toBe(0);
		expect(nav.popDepth()).toBe(false);
		expect(nav.currentDepth()).toBe(0);
		expect(nav.depthStack().length).toBe(1);
	});
});

// ── tab-switch resets focus to DEPTH_CENTER_PANE, not a sidebar ──────────────
test("tab-switch effect resets activePane to DEPTH_CENTER_PANE", () => {
	withNav((nav) => {
		// start on a depth-tab, land on the current pane.
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
		// move pane focus away (swipe is a noop for depth-tabs count=1, so
		// instead prove the effect resets on tab change).
		nav.setActiveTab(TABS.SEARCH);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
		// switch to another tab; the effect must reset to 0, never -1.
		nav.setActiveTab(TABS.SETTINGS);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
		expect(nav.activePane()).toBeGreaterThanOrEqual(0);
	});
});

test("tab-switch resets mode/visual/command state", () => {
	withNav((nav) => {
		nav.enterVisual();
		expect(nav.mode()).toBe(NavMode.VISUAL);
		nav.setActiveTab(TABS.DISCOVER);
		expect(nav.mode()).toBe(NavMode.NORMAL);
		expect(nav.visualAnchor()).toBeNull();
	});
});

// ── swipe clamps to [0, paneCount-1] (no sidebar slot) ────────────────────────
test("swipe(-1, 3) on a fixed-pane tab clamps to 0, not -1", () => {
	withNav((nav) => {
		nav.setActiveTab(TABS.SEARCH); // fixed-pane, TabPaneCount = 3
		expect(TabPaneCount[TABS.SEARCH]).toBe(3);
		// tab-switch effect lands us on pane 0 (DEPTH_CENTER_PANE).
		expect(nav.activePane()).toBe(0);
		nav.swipe(-1, TabPaneCount[TABS.SEARCH]);
		expect(nav.activePane()).toBe(0); // lower bound, never -1
		// swipe right twice then back: clamps to [0, 2].
		nav.swipe(1, 3);
		nav.swipe(1, 3);
		expect(nav.activePane()).toBe(2); // upper bound
		nav.swipe(1, 3);
		expect(nav.activePane()).toBe(2); // never exceeds count-1
		nav.swipe(-1, 3);
		expect(nav.activePane()).toBe(1);
		nav.swipe(-1, 3);
		expect(nav.activePane()).toBe(0);
	});
});

test("swipe on a single-pane fixed tab stays at 0", () => {
	withNav((nav) => {
		nav.setActiveTab(TABS.PLAYER); // single-pane
		expect(TabPaneCount[TABS.PLAYER]).toBe(1);
		expect(nav.activePane()).toBe(0);
		nav.swipe(1, TabPaneCount[TABS.PLAYER]);
		expect(nav.activePane()).toBe(0);
		nav.swipe(-1, TabPaneCount[TABS.PLAYER]);
		expect(nav.activePane()).toBe(0);
	});
});

// ── ensureStack seeds a root frame on first visit to a depth-tab ─────────────
test("switching to a fresh depth-tab seeds its root frame", () => {
	withNav((nav) => {
		nav.setActiveTab(TABS.DISCOVER);
		expect(nav.isDepthTab()).toBe(true);
		expect(nav.depthStack().length).toBe(1);
		expect(nav.topFrame()?.kind).toBe("discover:categories");
		nav.setActiveTab(TABS.SETTINGS);
		expect(nav.topFrame()?.kind).toBe("settings:sections");
	});
});
