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
 * `dispatch`. Behavioural rules (task 06):
 *
 *   • digit keys `1`-`6` / `tab-goto-*`, `tab-next` (`]`), `tab-prev` (`[`) are
 *     the SOLE tab switchers; focus always lands on `DEPTH_CENTER_PANE`.
 *   • `h`/`l` are `swipe-prev`/`swipe-next`:
 *       - depth-tabs, current pane: `l` drills (`open` emit), `h` pops a depth
 *         (noop + inert at depth 0 — no error, no pane change, like yazi at root)
 *       - fixed-pane tabs: `swipe(∓1, count)` clamped to [0, paneCount-1]
 *   • list/pane actions (`j`/`k`, `gg`/`G`, page-up/down, …) flow to
 *     `PAGE_ACTIONS` → `emit("nav.action")` for the current pane only.
 *   • `escape`/`command`/`visual-mode`/`toggle-select`/audio/global branches
 *     are unchanged from the pre-rewrite Shell.
 *
 * There is NO sidebar pane and NO `SIDEBAR_ACTIONS` set here (removed in task
 * 06): the sidebar's special-cased j/k branch is gone; every list movement
 * goes straight to the active page via `nav.action`.
 */

import type { KeybindActionName } from "@/context/KeybindContext";
import type { NavigationState, DepthFrame } from "@/context/navigation-store";
import { NavMode, DEPTH_CENTER_PANE } from "@/context/navigation-store";
import { TABS, TabsCount, TabPaneCount } from "@/utils/navigation";
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
export const PAGE_ACTIONS: ReadonlySet<KeybindActionName> = new Set<KeybindActionName>([
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
	"filter",
	"sort",
	"toggle-hidden",
	"refresh",
]);

/** Resolve a `tab-goto-N` digit action (1..TabsCount) to a TABS value, or null. */
export function tabByDigit(action: KeybindActionName): TABS | null {
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

	function dispatch(action: KeybindActionName, evt: { preventDefault: () => void }) {
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
				// ── pane swipe / depth nav ──
				// h/l swipe() on fixed-pane tabs (clamped to [0, paneCount-1] —
				// there is no sidebar pane). Depth-tabs: l at the center drills
				// in (emits `open`); h at the center pops a depth, noop at depth 0
				// (inert — like yazi at root: no pane change, no error).
				if (action === "swipe-prev") {
					evt.preventDefault();
					if (
						nav.isDepthTab() &&
						nav.activePane() === DEPTH_CENTER_PANE
					) {
						if (nav.currentDepth() > 0) nav.popDepth();
						// else: noop at depth 0 (inert)
					} else {
						nav.swipe(-1, TabPaneCount[tab]);
					}
					break;
				}
				if (action === "swipe-next") {
					evt.preventDefault();
					if (nav.isDepthTab() && nav.activePane() === DEPTH_CENTER_PANE) {
						emit("nav.action", {
							action: "open",
							tab,
							pane: DEPTH_CENTER_PANE,
							mode: nav.mode(),
						});
					} else {
						nav.swipe(1, TabPaneCount[tab]);
					}
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
