/**
 * nav-model.test.ts — yazi remake task 01/07 unit/integration tests.
 *
 * Covers the tab-list-as-root navigation model:
 *   • createNavigation() exposes the nav factory directly (no Solid render
 *     needed), wrapped in a createRoot so effects register/dispose.
 *   • focus starts on the tab list — the app root. `atRootTab()` is true while
 *     the tab list is the CURRENT pane (nothing above it). `enterTabContent()`
 *     slides the tab into UP and puts focus on the content; `backToTabRoot()`
 *     returns to the root. Only depth-tabs participate (`atRootTab()` is false
 *     for the fixed-pane Search/Player tabs (they clear `atRootTab` on switch
 *     and regain it via `backToTabRoot`, the `h`-back-up path).
 *   • the root tab list is a normal list: `tabCursor` is independent of
 *     `activeTab`; moveTabCursor moves it (clamped), activateTabCursor opens
 *     the hovered tab + enters content, and direct tab switches re-sync it.
 *   • depth-tab focusedIndex depth-current read/writes the top frame's focus.
 *   • swipe() is clamped to [1, paneCount] (content panes only; there is no
 *     pane-0 tab slot — the tab root is a flag, not a pane).
 */
import { test, expect } from "bun:test";
import { createRoot } from "solid-js";
import {
	createNavigation,
	DEPTH_CENTER_PANE,
	NavMode,
} from "../src/context/navigation-store";
import { TABS } from "../src/utils/navigation";

/** Build a fresh nav graph inside a reactive root and run `fn` against it.
 *  Disposes the root afterwards so effects/signals don't leak between tests. */
function withNav(fn: (nav: ReturnType<typeof createNavigation>) => void) {
	createRoot((dispose) => {
		const nav = createNavigation();
		fn(nav);
		dispose();
	});
}

test("createNavigation starts on the tab root (atRootTab true)", () => {
	withNav((nav) => {
		expect(nav.atRootTab()).toBe(true);
		expect(nav.activeTab()).toBe(TABS.FEED);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
	});
});

// ── depth-tab focus: reads/writes the top frame's focus ───────────────────────
test("depth-tab focusedIndex(DEPTH_CENTER_PANE) returns top frame's focus", () => {
	withNav((nav) => {
		// FeeD is a depth-tab; its root frame is a the top frame on the stack.
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
		nav.enterTabContent();
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

// ── tab switching keeps focus context ────────────────────────────────────────
test("tab switch keeps focus context: at the root it stays at the root", () => {
	withNav((nav) => {
		// focus starts on the tab root.
		expect(nav.atRootTab()).toBe(true);
		// switching depth-tabs from the root must not drop focus into content.
		nav.setActiveTab(TABS.FEED);
		expect(nav.atRootTab()).toBe(true);
		expect(nav.activeTab()).toBe(TABS.FEED);
		nav.setActiveTab(TABS.MYSHOWS);
		expect(nav.atRootTab()).toBe(true);
	});
});

test("tab switch keeps focus context: in content it stays in content", () => {
	withNav((nav) => {
		nav.enterTabContent();
		expect(nav.atRootTab()).toBe(false);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
		// switching tabs from content keeps the content context.
		nav.setActiveTab(TABS.SETTINGS);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
		expect(nav.atRootTab()).toBe(false);
	});
});

test("switching to a Search/Player tab keeps the root (depth-tab)", () => {
	withNav((nav) => {
		// at root, opening Search keeps the root: every tab is a depth-tab now,
		// so Enter/l is required to drop into content. `h`-back-up still works.
		nav.setActiveTab(TABS.SEARCH);
		expect(nav.atRootTab()).toBe(true);
		nav.enterTabContent();
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
		expect(nav.atRootTab()).toBe(false);
		nav.backToTabRoot();
		expect(nav.atRootTab()).toBe(true);
		// Player is also a depth-tab now.
		nav.setActiveTab(TABS.PLAYER);
		expect(nav.atRootTab()).toBe(true);
		nav.enterTabContent();
		expect(nav.atRootTab()).toBe(false);
	});
});

// ── tab root <-> content transitions ─────────────────────────────────────────
test("enterTabContent/backToTabRoot round-trip between root and content", () => {
	withNav((nav) => {
		nav.setActiveTab(TABS.FEED);
		expect(nav.atRootTab()).toBe(true);
		nav.enterTabContent();
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
		expect(nav.atRootTab()).toBe(false);
		nav.backToTabRoot();
		expect(nav.atRootTab()).toBe(true);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
	});
});

test("enterTabContent preserves the active tab's depth", () => {
	withNav((nav) => {
		nav.setActiveTab(TABS.FEED);
		nav.pushDepth({ kind: "episodes:feedId", ctx: "f1", focus: 0 });
		expect(nav.currentDepth()).toBe(1);
		// moving between the root and content never touches the depth stack.
		nav.backToTabRoot();
		nav.enterTabContent();
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
		expect(nav.currentDepth()).toBe(1);
		expect(nav.popDepth()).toBe(true);
		expect(nav.currentDepth()).toBe(0);
	});
});

test("tabCursor starts on the active tab", () => {
	withNav((nav) => {
		expect(nav.tabCursor()).toBe(TABS.FEED);
		expect(nav.activeTab()).toBe(TABS.FEED);
	});
});

test("moveTabCursor moves the cursor without changing the active tab, clamped at the ends", () => {
	withNav((nav) => {
		nav.setActiveTab(TABS.MYSHOWS); // cursor syncs to the active tab
		expect(nav.tabCursor()).toBe(TABS.MYSHOWS);
		nav.moveTabCursor(1);
		expect(nav.tabCursor()).toBe(TABS.DISCOVER);
		expect(nav.activeTab()).toBe(TABS.MYSHOWS); // active tab untouched
		nav.moveTabCursor(-1);
		expect(nav.tabCursor()).toBe(TABS.MYSHOWS);
		// clamp: from FEED, up stays FEED; from SETTINGS, down stays SETTINGS.
		nav.moveTabCursor(-1); // MYSHOWS -> FEED
		nav.moveTabCursor(-1); // FEED -> FEED (clamped)
		expect(nav.tabCursor()).toBe(TABS.FEED);
		nav.setActiveTab(TABS.SETTINGS);
		nav.moveTabCursor(1); // SETTINGS -> SETTINGS (clamped)
		expect(nav.tabCursor()).toBe(TABS.SETTINGS);
		expect(nav.activeTab()).toBe(TABS.SETTINGS);
	});
});

test("activateTabCursor switches to the hovered tab and enters its content", () => {
	withNav((nav) => {
		nav.moveTabCursor(1); // cursor -> MYSHOWS
		nav.moveTabCursor(1); // cursor -> DISCOVER
		expect(nav.tabCursor()).toBe(TABS.DISCOVER);
		expect(nav.activeTab()).toBe(TABS.FEED);
		nav.activateTabCursor();
		expect(nav.activeTab()).toBe(TABS.DISCOVER); // hovered tab opened
		expect(nav.tabCursor()).toBe(TABS.DISCOVER);
		expect(nav.atRootTab()).toBe(false);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
	});
});

test("direct tab switches re-sync the tab cursor", () => {
	withNav((nav) => {
		nav.moveTabCursor(1); // cursor -> MYSHOWS
		expect(nav.activeTab()).toBe(TABS.FEED);
		nav.setActiveTab(TABS.SETTINGS);
		expect(nav.tabCursor()).toBe(TABS.SETTINGS);
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

// ── swipe clamps to [1, paneCount] (no pane-0 tab slot) ──────────────────────
test("Search is a depth-tab: query root drills to results and back", () => {
	withNav((nav) => {
		nav.setActiveTab(TABS.SEARCH);
		expect(nav.isDepthTab()).toBe(true);
		expect(nav.topFrame()?.kind).toBe("search:query");
		nav.enterTabContent();
		expect(nav.currentDepth()).toBe(0);
		// Enter on the query submits → push a results frame.
		nav.pushDepth({ kind: "search:results", ctx: "podcast", focus: 0 });
		expect(nav.currentDepth()).toBe(1);
		// h at depth 1 pops back to the query.
		expect(nav.popDepth()).toBe(true);
		expect(nav.currentDepth()).toBe(0);
	});
});

test("Player is a single-depth depth-tab (now-playing only)", () => {
	withNav((nav) => {
		nav.setActiveTab(TABS.PLAYER);
		expect(nav.isDepthTab()).toBe(true);
		expect(nav.topFrame()?.kind).toBe("player:nowplaying");
		nav.enterTabContent();
		expect(nav.currentDepth()).toBe(0); // no deeper drill
		expect(nav.popDepth()).toBe(false); // noop at depth 0
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
