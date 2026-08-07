/**
 * dispatch-keybinds.test.ts — yazi remake task 06/07 unit + integration tests.
 *
 * Exercises the rewired unified keybind router (`createDispatcher`) directly,
 * without the OpenTUI render tree, mirroring how task 01 made the nav store a
 * plain factory for `bun test`. Covers the task 06 acceptance + integration
 * cases, plus the tab-root routing:
 *
 *   • Tab root: j/k (`move-down`/`move-up`) move a tab cursor without touching
 *     the active tab; `open`/`swipe-next` (l/Enter) open the hovered tab and
 *     enter its content; `swipe-prev` (h) stays inert (out of the panes).
 *   • Depth-tab content: `swipe-next` (l) at depth 0 emits `open` (drill);
 *     `swipe-prev` (h) pops depth 1→0 and, at depth 0, returns to the tab root.
 *   • Fixed-pane tabs (Search/Player, special): `h`/`l` swipe [1, paneCount];
 *     `h` on the first pane stays — never overflows to the tab root.
 *   • Digit keys (`tab-goto-N`), `tab-next` (`]`), `tab-prev` (`[`) switch
 *     tabs and preserve focus context (root stays root for depth-tabs, content
 *     stays content).
 *   • `j`/`k` (move-down/up) in content flow to `nav.action` for the current
 *     pane.
 *
 * The dispatcher is built with fake audio/k/help deps (the paths under test
 * never reach the audio or advanceEpisode branches) and a real nav store.
 */
import { test, expect, mock } from "bun:test";
import { createRoot } from "solid-js";
import {
	createNavigation,
	DEPTH_CENTER_PANE,
} from "../src/context/navigation-store";
import { TABS } from "../src/utils/navigation";
import { createDispatcher, type DispatcherDeps } from "../src/utils/dispatch";
import { on } from "../src/utils/event-bus";
import type { KeybindActionName } from "../src/context/KeybindContext";

/** Build a real nav store + a dispatcher wired to fake audio/k/help deps, all
 *  inside a reactive root (disposed after). Returns both so a test can read
 *  nav state and call dispatch. */
function withHarness(
	fn: (api: {
		nav: ReturnType<typeof createNavigation>;
		dispatch: (action: KeybindActionName) => void;
		toggleHelp: () => boolean;
		helpOpen: () => boolean;
	}) => void,
) {
	createRoot((dispose) => {
		const nav = createNavigation();
		let help = false;
		const deps: DispatcherDeps = {
			nav,
			audio: {
				togglePlayback: async () => {},
				seekRelative: async () => {},
			},
			k: { clearPending: () => {} },
			setShowHelp: (fn) => {
				help = fn(help);
			},
			advanceEpisode: () => {},
		};
		const { dispatch } = createDispatcher(deps);
		const evt = () => ({ preventDefault: mock(() => {}) });
		fn({
			nav,
			dispatch: (action) => dispatch(action, evt() as any),
			toggleHelp: () => (help = !help),
			helpOpen: () => help,
		});
		dispose();
	});
}

/** Capture nav.action emits during `fn`. Returns the captured payloads. */
function captureNavActions(fn: () => void) {
	const captured: { action: KeybindActionName; tab: TABS; pane: number }[] = [];
	const unsub = on("nav.action", (d) => {
		captured.push(d as any);
	});
	try {
		fn();
	} finally {
		unsub();
	}
	return captured;
}

// ── Tab root: j/k move the cursor; l/Enter open the hovered tab ──────────────
test("dispatch('move-down') on the tab root moves the cursor (no emit, active tab untouched)", () => {
	withHarness(({ nav, dispatch }) => {
		expect(nav.atRootTab()).toBe(true);
		expect(nav.tabCursor()).toBe(TABS.FEED);

		const events = captureNavActions(() => dispatch("move-down"));
		expect(events).toHaveLength(0); // j on the root moves the cursor only
		expect(nav.tabCursor()).toBe(TABS.MYSHOWS);
		expect(nav.activeTab()).toBe(TABS.FEED); // active tab untouched until opened
		expect(nav.atRootTab()).toBe(true);
	});
});

test("dispatch('move-up') on the tab root moves the cursor up (clamped, no wrap)", () => {
	withHarness(({ nav, dispatch }) => {
		expect(nav.tabCursor()).toBe(TABS.FEED);
		dispatch("move-up");
		expect(nav.tabCursor()).toBe(TABS.FEED); // clamped at the top
		expect(nav.activeTab()).toBe(TABS.FEED);
		expect(nav.atRootTab()).toBe(true);
	});
});

test("dispatch('open') on the tab root opens the hovered tab and enters its content", () => {
	withHarness(({ nav, dispatch }) => {
		dispatch("move-down"); // cursor -> MYSHOWS
		dispatch("move-down"); // cursor -> DISCOVER
		expect(nav.tabCursor()).toBe(TABS.DISCOVER);
		dispatch("open");
		expect(nav.activeTab()).toBe(TABS.DISCOVER); // the hovered tab is opened
		expect(nav.atRootTab()).toBe(false);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
	});
});

test("dispatch('swipe-next') on the tab root opens the hovered tab and enters its content (no emit)", () => {
	withHarness(({ nav, dispatch }) => {
		dispatch("move-down"); // cursor -> MYSHOWS
		const events = captureNavActions(() => dispatch("swipe-next"));
		expect(events).toHaveLength(0);
		expect(nav.activeTab()).toBe(TABS.MYSHOWS);
		expect(nav.atRootTab()).toBe(false);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
	});
});

test("dispatch('swipe-prev') on the tab root is inert (stays, no emit)", () => {
	withHarness(({ nav, dispatch }) => {
		const events = captureNavActions(() => dispatch("swipe-prev"));
		expect(events).toHaveLength(0);
		expect(nav.atRootTab()).toBe(true);
	});
});

// ── Unit: move-down emits nav.action on the current pane only ────────────────
test("dispatch('move-down') on a depth-tab current pane emits nav.action {action:'move-down'} on the current pane", () => {
	withHarness(({ nav, dispatch }) => {
		nav.setActiveTab(TABS.FEED); // depth-tab → enter content to test the list move
		nav.enterTabContent();
		expect(nav.isDepthTab()).toBe(true);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);

		const events = captureNavActions(() => dispatch("move-down"));
		expect(events).toHaveLength(1);
		expect(events[0].action).toBe("move-down");
		expect(events[0].tab).toBe(TABS.FEED);
		expect(events[0].pane).toBe(DEPTH_CENTER_PANE);
	});
});

test("dispatch('move-up') emits nav.action on the current pane only (j/k never change depth)", () => {
	withHarness(({ nav, dispatch }) => {
		nav.setActiveTab(TABS.MYSHOWS);
		nav.enterTabContent();
		const beforeDepth = nav.currentDepth();
		const events = captureNavActions(() => dispatch("move-up"));
		expect(events).toHaveLength(1);
		expect(events[0].action).toBe("move-up");
		expect(events[0].pane).toBe(DEPTH_CENTER_PANE);
		// depth is untouched by j/k (only h/l and the page's open() touch it).
		expect(nav.currentDepth()).toBe(beforeDepth);
	});
});

// ── Integration: l drills (open emit), h pops, h@0 → tab root ────────────────
test("dispatch('swipe-next') on a depth-tab at depth 0 emits 'open' (drill)", () => {
	withHarness(({ nav, dispatch }) => {
		nav.setActiveTab(TABS.DISCOVER);
		nav.enterTabContent();
		expect(nav.isDepthTab()).toBe(true);
		expect(nav.currentDepth()).toBe(0);

		const events = captureNavActions(() => dispatch("swipe-next"));
		expect(events).toHaveLength(1);
		expect(events[0].action).toBe("open");
		expect(events[0].pane).toBe(DEPTH_CENTER_PANE);
		// the drill (pushDepth) is the page's job on `open`; dispatch only emits.
		expect(nav.currentDepth()).toBe(0);
	});
});

test("dispatch('swipe-prev') at depth 1 pops to depth 0", () => {
	withHarness(({ nav, dispatch }) => {
		nav.setActiveTab(TABS.FEED);
		nav.enterTabContent();
		// simulate the page's open() having drilled one level.
		nav.pushDepth({ kind: "episodes:f1", ctx: "f1", focus: 0 });
		expect(nav.currentDepth()).toBe(1);

		const events = captureNavActions(() => dispatch("swipe-prev"));
		expect(events).toHaveLength(0); // a pop emits nothing — it just pops
		expect(nav.currentDepth()).toBe(0);
		// focus stays in content (depth > 0 pop does not return to the root).
		expect(nav.atRootTab()).toBe(false);
	});
});

test("dispatch('swipe-prev') at depth 0 returns focus to the tab root", () => {
	withHarness(({ nav, dispatch }) => {
		nav.setActiveTab(TABS.SETTINGS);
		nav.enterTabContent();
		expect(nav.currentDepth()).toBe(0);
		expect(nav.atRootTab()).toBe(false);

		const events = captureNavActions(() => dispatch("swipe-prev"));
		expect(events).toHaveLength(0);
		expect(nav.currentDepth()).toBe(0);
		expect(nav.atRootTab()).toBe(true);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
	});
});

test("dispatch('swipe-prev') on a fixed-pane tab at pane 1 stays (no tab overflow)", () => {
	withHarness(({ nav, dispatch }) => {
		nav.setActiveTab(TABS.SEARCH); // fixed-pane
		nav.enterTabContent();
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);

		dispatch("swipe-prev");
		// special tab: h on the first content pane does not return to the root.
		expect(nav.atRootTab()).toBe(false);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
	});
});

test("dispatch('swipe-prev') on a fixed-pane tab at pane > 1 swipes leftwards", () => {
	withHarness(({ nav, dispatch }) => {
		nav.setActiveTab(TABS.SEARCH); // 3 panes
		nav.enterTabContent();
		nav.swipe(1, 3);
		nav.swipe(1, 3);
		expect(nav.activePane()).toBe(3);
		dispatch("swipe-prev");
		expect(nav.activePane()).toBe(2);
	});
});

// ── Acceptance: digit keys switch tabs and keep focus context ────────────────
test("tab-goto-N from the root keeps depth-tabs at the root; special tabs open", () => {
	withHarness(({ nav, dispatch }) => {
		// focus starts on the tab root.
		expect(nav.atRootTab()).toBe(true);

		dispatch("tab-goto-3"); // → Discover
		expect(nav.activeTab()).toBe(TABS.DISCOVER);
		expect(nav.tabCursor()).toBe(TABS.DISCOVER); // cursor re-synced
		expect(nav.atRootTab()).toBe(true);

		dispatch("tab-goto-2"); // → MyShows
		expect(nav.activeTab()).toBe(TABS.MYSHOWS);
		expect(nav.tabCursor()).toBe(TABS.MYSHOWS);
		expect(nav.atRootTab()).toBe(true);

		// fixed-pane tab is special: switching from the root opens its content.
		dispatch("tab-goto-4"); // → Search
		expect(nav.activeTab()).toBe(TABS.SEARCH);
		expect(nav.tabCursor()).toBe(TABS.SEARCH);
		expect(nav.atRootTab()).toBe(false);
	});
});

test("tab-goto-N from content keeps focus in the active tab's content", () => {
	withHarness(({ nav, dispatch }) => {
		nav.enterTabContent();
		expect(nav.atRootTab()).toBe(false);

		dispatch("tab-goto-3"); // → Discover
		expect(nav.activeTab()).toBe(TABS.DISCOVER);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);

		dispatch("tab-goto-4"); // → Search (fixed-pane) lands its current pane
		expect(nav.activeTab()).toBe(TABS.SEARCH);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
		expect(nav.atRootTab()).toBe(false);
	});
});

test("tab-next (]) / tab-prev ([) cycle tabs and keep focus context", () => {
	withHarness(({ nav, dispatch }) => {
		expect(nav.activeTab()).toBe(TABS.FEED);
		expect(nav.atRootTab()).toBe(true);

		dispatch("tab-next");
		expect(nav.activeTab()).toBe(TABS.MYSHOWS);
		expect(nav.tabCursor()).toBe(TABS.MYSHOWS);
		expect(nav.atRootTab()).toBe(true);

		dispatch("tab-prev");
		expect(nav.activeTab()).toBe(TABS.FEED);
		expect(nav.tabCursor()).toBe(TABS.FEED);
		expect(nav.atRootTab()).toBe(true);
	});
});

test("help toggles open on the 'help' action", () => {
	withHarness(({ dispatch, helpOpen }) => {
		expect(helpOpen()).toBe(false);
		dispatch("help");
		expect(helpOpen()).toBe(true);
		dispatch("help");
		expect(helpOpen()).toBe(false);
	});
});
