/**
 * dispatch — the yazi-style unified keybind router.
 *
 * Extracted from `src/components/Shell.tsx` into this pure (no-JSX, no
 * @opentui/solid) module so `dispatch()` is unit-testable with `bun test`
 * directly — mirroring how task 01 split `navigation-store` out of the
 * NavigationContext so the nav model could be exercised without the OpenTUI
 * JSX runtime (supplied only by the build-time bun-plugin).
 *
 * The Shell builds a `DispatcherDeps` from its live hooks + the audio-side
 * `advanceEpisode` helper, then forwards every matched keystroke action to
 * `dispatch`. Behavioural rules (tab root + task 06):
 *
 *   • The tab list is the app's ROOT. At the root (`nav.atRootTab()`) it is
 *     the CURRENT pane with nothing above it:
 *     `k`/`j` (`move-down`/`move-up`) move a cursor through the tabs
 *     (highlight follows `tabCursor`; the active tab is untouched),
 *     `l`/Enter (`swipe-next`/`open`) open the hovered tab (`activateTabCursor`)
 *     — the tab slides into UP and its content becomes CURRENT; `h`
 *     (`swipe-prev`) at the root stays (out of the panes); `1-6` / `[`/`]`
 *     switch tabs directly (re-syncing the cursor).
 *   • digit keys `1`-`6` / `tab-goto-*`, `tab-next` (`]`), `tab-prev` (`[`)
 *     switch tabs; focus keeps its context (root iff already at the root,
 *     otherwise the content `DEPTH_CENTER_PANE`).
 *   • `h`/`l` are `swipe-prev`/`swipe-next` in content (every tab is a
 *     depth-tab): `l` at the current pane drills in (emits `open`); `h` pops
 *     a depth when depth > 0; at depth 0 `h` returns to the tab root
 *     (`backToTabRoot`), where the tab becomes CURRENT again.
 *   • list/pane actions (`j`/`k`, `gg`/`G`, page-up/down, …) flow to
 *     `PAGE_ACTIONS` → `emit("nav.action")` for the current active content pane.
 *   • `escape`/`command`/`visual-mode`/`toggle-select`/audio/global branches
 *     are unchanged from the pre-rewrite Shell. */

import type { KeybindActionName } from "@/context/KeybindContext";
import type { NavigationState, DepthFrame } from "@/context/navigation-store";
import { NavMode, DEPTH_CENTER_PANE } from "@/context/navigation-store";
import { TABS, TabsCount } from "@/utils/navigation";
import { emit } from "@/utils/event-bus";

// Re-export NavMode + DEPTH_CENTER_PANE so Shell keeps importing them from here.
export { DEPTH_CENTER_PANE, NavMode };

/** The payload carried on the `nav.action` event bus. Mirrors the typed event
 *  in utils/event-bus.ts but duplicated here so this module stays dep-light. */
export type NavActionEvent = {
	action: KeybindActionName;
	tab: TABS;
	pane: number;
	mode: NavMode;
};

/** Actions the active page is responsible for (pane/list-local). These flow
 *  to the current pane only via `emit("nav.action", …)`. There is no
 *  SIDEBAR_ACTIONS set — the sidebar pane was removed in the nav rework. */
export const PAGE_ACTIONS: ReadonlySet<KeybindActionName> =
	new Set<KeybindActionName>([
		"move-down",
		"move-up",
		"page-down",
		"page-up",
		"full-down",
		"full-up",
		"jump-down",
		"jump-up",
		"goto-top",
		"goto-bottom",
		"toggle-select",
		"visual-mode",
		"toggle-all",
		"invert-all",
		"open",
		"open-interactive",
		"search",
		"search-scope-toggle",
		"filter",
		"sort",
		"toggle-hidden",
		"refresh",
		"subscribe",
		"unsubscribe",
		"download",
		"delete-download",
		"whitelist-toggle",
	]);

/** Resolve a `tab-goto-N` digit action (1..TabsCount) to a TABS value, or null. */
function tabByDigit(action: KeybindActionName): TABS | null {
	if (action.startsWith("tab-goto-")) {
		const n = Number(action.slice("tab-goto-".length));
		return (n >= 1 && n <= TabsCount ? n : null) as TABS | null;
	}
	return null;
}

/** Dependencies the unified keybind dispatcher closes over. `advanceEpisode`
 *  is passed in (it lives over the full audio/feed/toast surface in Shell) so
 *  the dispatcher only needs the subset it touches directly. */
export type DispatcherDeps = {
	nav: NavigationState;
	audio: {
		togglePlayback: () => Promise<void>;
		seekRelative: (n: number) => Promise<void>;
	};
	k: { clearPending: () => void };
	setShowHelp: (fn: (v: boolean) => boolean) => void;
	advanceEpisode: (offset: number) => void;
};

/** Build the unified router (normal + visual modes). Returns `dispatch` —
 *  the closure Shell's `useKeyboard` calls with each matched action. */
export function createDispatcher(deps: DispatcherDeps) {
	const { nav, audio, k, setShowHelp, advanceEpisode } = deps;

	function dispatch(
		action: KeybindActionName,
		evt: { preventDefault: () => void },
	) {
		const tab = nav.activeTab();
		const pane = nav.activePane();
		switch (action) {
			// ── modes ──
			case "escape":
				evt.preventDefault();
				if (nav.mode() === NavMode.VISUAL) {
					nav.toNormal();
					break;
				}
				k.clearPending();
				break;
			case "command":
				evt.preventDefault();
				nav.enterCommand();
				break;
			case "visual-mode":
				evt.preventDefault();
				nav.enterVisual();
				break;
			case "toggle-select":
				evt.preventDefault();
				emit("nav.action", { action, tab, pane, mode: nav.mode() });
				break;
			case "toggle-all":
			case "invert-all":
				evt.preventDefault();
				emit("nav.action", { action, tab, pane, mode: nav.mode() });
				break;

			// ── tabs (the only tab switchers) ──
			case "tab-next":
				evt.preventDefault();
				nav.nextTab();
				break;
			case "tab-prev":
				evt.preventDefault();
				nav.prevTab();
				break;
			default: {
				const dt = tabByDigit(action);
				if (dt) {
					evt.preventDefault();
					nav.setActiveTab(dt);
					break;
				}
				// ── tab root focus ──
				// At the app root the tab list is the CURRENT pane: j/k move the tab
				// cursor (active tab untouched), l/Enter open the hovered tab (switch
				// to it + enter its content), h stays inert (out of the panes).
				if (nav.atRootTab()) {
					evt.preventDefault();
					if (action === "move-down") {
						nav.moveTabCursor(1);
						break;
					}
					if (action === "move-up") {
						nav.moveTabCursor(-1);
						break;
					}
					if (action === "open") {
						nav.activateTabCursor();
						break;
					}
					if (action === "swipe-next") {
						nav.activateTabCursor();
						break;
					}
					if (action === "swipe-prev") break;
				}
				// ── pane swipe / depth nav ──
				// Every tab is a depth-tab: `l` at the center drills in (emits `open`);
				// `h` at the center pops a depth when depth > 0, and at depth 0 returns
				// to the tab root (the tab becomes CURRENT again).
				if (action === "swipe-prev") {
					evt.preventDefault();
					if (nav.currentDepth() > 0) nav.popDepth();
					else nav.backToTabRoot(); // depth 0 → tab root
					break;
				}
				if (action === "swipe-next") {
					evt.preventDefault();
					emit("nav.action", {
						action: "open",
						tab,
						pane: DEPTH_CENTER_PANE,
						mode: nav.mode(),
					});
					break;
				}
				// ── audio transport (global) ──
				if (action === "audio-toggle") {
					evt.preventDefault();
					audio.togglePlayback().catch(() => {});
					break;
				}
				if (action === "audio-seek-forward") {
					evt.preventDefault();
					audio.seekRelative(10).catch(() => {});
					break;
				}
				if (action === "audio-seek-backward") {
					evt.preventDefault();
					audio.seekRelative(-10).catch(() => {});
					break;
				}
				if (action === "audio-next") {
					evt.preventDefault();
					advanceEpisode(1);
					break;
				}
				if (action === "audio-prev") {
					evt.preventDefault();
					advanceEpisode(-1);
					break;
				}
				// ── global app ──
				if (action === "quit") {
					evt.preventDefault();
					process.exit(0);
				}
				if (action === "help") {
					evt.preventDefault();
					setShowHelp((v) => !v);
				}

				// ── page-local list/pane actions ──
				if (PAGE_ACTIONS.has(action)) {
					evt.preventDefault();
					emit("nav.action", { action, tab, pane, mode: nav.mode() });
				}
			}
		}
	}

	return { dispatch };
}

// Re-export the depth-frame type for convenience.
export type { DepthFrame };
