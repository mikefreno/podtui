/**
 * dispatch-keybinds.test.ts — yazi remake task 06 unit + integration tests.
 *
 * Exercises the rewired unified keybind router (`createDispatcher`) directly,
 * without the OpenTUI render tree, mirroring how task 01 made the nav store a
 * plain factory for `bun test`. Covers the task 06 acceptance + integration
 * cases:
 *
 *   • Unit: `dispatch("move-down")` on a depth-tab current pane emits
 *     `nav.action { action: "move-down" }` pointing at the current pane only.
 *   • Integration: `swipe-next` (l) on a depth-tab at depth 0 emits `open`
 *     (drill); `swipe-prev` (h) at depth 1 pops to depth 0; `swipe-prev` at
 *     depth 0 is an inert noop (no emit, no pane/depth change, no error).
 *   • Acceptance: digit keys (`tab-goto-N`) switch tabs and focus lands on
 *     `DEPTH_CENTER_PANE`; `tab-next`/`tab-prev` cycle; `h` at depth 0 is
 *     inert; `j`/`k` (move-down/up) flow to `nav.action` for the current pane.
 *
 * The dispatcher is built with fake audio/k/help deps (the drills/moves under
 * test never reach the audio or advanceEpisode paths) and a real nav store —
 * the shared contract depth/l movement routes through.
 */
import { test, expect, mock } from "bun:test";
import { createRoot } from "solid-js";
import { createNavigation, DEPTH_CENTER_PANE } from "../src/context/navigation-store";
import { TABS } from "../src/utils/navigation";
import { createDispatcher, type DispatcherDeps } from "../src/utils/dispatch";
import { on } from "../src/utils/event-bus";
import type { KeybindActionName } from "../src/context/KeybindContext";

/** Build a real nav store + a dispatcher wired to fake audio/k/help deps, all
 *  inside a reactive root (disposed after). Returns both so a test can read
 *  nav state and call dispatch. */
function withHarness(fn: (api: {
	nav: ReturnType<typeof createNavigation>;
	dispatch: (action: KeybindActionName) => void;
	toggleHelp: () => boolean;
	helpOpen: () => boolean;
}) => void) {
	createRoot((dispose) => {
		const nav = createNavigation();
		let help = false;
		const toggleHelp = () => (help = !help);
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
			toggleHelp,
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

// ── Unit: move-down emits nav.action on the current pane only ─────────────────
test("dispatch('move-down') on a depth-tab current pane emits nav.action {action:'move-down'} on the current pane", () => {
	withHarness(({ nav, dispatch }) => {
		nav.setActiveTab(TABS.FEED); // depth-tab → focus is the center pane
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
		const beforeDepth = nav.currentDepth();
		const beforePane = nav.activePane();
		const events = captureNavActions(() => dispatch("move-up"));
		expect(events).toHaveLength(1);
		expect(events[0].action).toBe("move-up");
		expect(events[0].pane).toBe(beforePane);
		// depth is untouched by j/k (only h/l and the page's open() touch it).
		expect(nav.currentDepth()).toBe(beforeDepth);
	});
});

// ── Integration: l drills (open emit), h pops, h@0 noop ──────────────────────
test("dispatch('swipe-next') on a depth-tab at depth 0 emits 'open' (drill)", () => {
	withHarness(({ nav, dispatch }) => {
		nav.setActiveTab(TABS.DISCOVER);
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
		// simulate the page's open() having drilled one level.
		nav.pushDepth({ kind: "episodes:f1", ctx: "f1", focus: 0 });
		expect(nav.currentDepth()).toBe(1);

		const events = captureNavActions(() => dispatch("swipe-prev"));
		expect(events).toHaveLength(0); // a pop emits nothing — it just pops
		expect(nav.currentDepth()).toBe(0);
	});
});

test("dispatch('swipe-prev') at depth 0 is an inert noop (no emit, no pane/depth change, no error)", () => {
	withHarness(({ nav, dispatch }) => {
		nav.setActiveTab(TABS.SETTINGS);
		expect(nav.currentDepth()).toBe(0);
		const paneBefore = nav.activePane();

		const events = captureNavActions(() => dispatch("swipe-prev"));
		expect(events).toHaveLength(0);
		expect(nav.currentDepth()).toBe(0);
		expect(nav.activePane()).toBe(paneBefore);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
	});
});

// ── Acceptance: digit keys switch tabs and land focus on the current pane ──
test("tab-goto-N switches tabs; focus always lands on DEPTH_CENTER_PANE", () => {
	withHarness(({ nav, dispatch }) => {
		// start on FEED (depth-tab, depth 0).
		expect(nav.activeTab()).toBe(TABS.FEED);

		dispatch("tab-goto-3"); // → Discover
		expect(nav.activeTab()).toBe(TABS.DISCOVER);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);

		dispatch("tab-goto-2"); // → MyShows
		expect(nav.activeTab()).toBe(TABS.MYSHOWS);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);

		// fixed-pane tab also lands on pane 0.
		dispatch("tab-goto-4"); // → Search
		expect(nav.activeTab()).toBe(TABS.SEARCH);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
	});
});

test("tab-next (]) / tab-prev ([) cycle tabs and reset focus to the current pane", () => {
	withHarness(({ nav, dispatch }) => {
		nav.setActiveTab(TABS.FEED);
		dispatch("tab-next");
		expect(nav.activeTab()).toBe(TABS.MYSHOWS);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);

		dispatch("tab-prev");
		expect(nav.activeTab()).toBe(TABS.FEED);
		expect(nav.activePane()).toBe(DEPTH_CENTER_PANE);
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
