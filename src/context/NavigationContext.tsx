import { createEffect, createSignal, on, batch, createMemo } from "solid-js";
import { createSimpleContext } from "./helper";
import { TABS, TabsCount, DEPTH_TABS, rootFrameFor } from "@/utils/navigation";

// ── Yazi-style navigation state ──────────────────────────────────────────────
// Two pane models coexist:
//
//  • Depth-stack tabs (Feed, MyShows, Discover, Settings) use a yazi-style
//    depth stack. The three content columns render as:
//        left   = the previous depth's list  (empty at depth 0)
//        center = the current depth's list   (always where focus lives)
//        right  = preview of the hovered item in center
//    `l`/Enter drills in (push); `h` pops back (or yields to the sidebar at
//    depth 0). Depth is unbounded — each page decides per-item whether an
//    item is drillable and what child list kind to push.
//
//  • Fixed-pane tabs (Search = input/results/detail, Player = single) keep the
//    old indexed pane model (`focusedIndex(pane)` + `swipe`).
//
// The Shell's left tab sidebar is a special pane that sits *before* the
// content area. It uses SIDEBAR_PANE (-1) so the h/l chain naturally lands on
// it as the leftmost/root pane.

export enum NavMode {
	NORMAL = "NORMAL",
	VISUAL = "VISUAL",
	COMMAND = "COMMAND",
	INPUT = "INPUT",
}

/** The tab sidebar (chrome) pane. Always the leftmost focus target. */
export const SIDEBAR_PANE = -1 as PaneId;

/** For depth-tabs, the current-depth (center) pane is the only focusable
 *  content pane — index 0. The prev/preview columns are derived, not focused. */
export const DEPTH_CENTER_PANE = 0 as PaneId;

/** The sidebar pane's "list" is the tab list itself: its focus cursor is the
 *  active tab (1-based) minus 1, and moving/setting it switches tabs via the
 *  standard focusedIndex/move/gotoIndex API — no special-cased nextTab. */

/** Legacy pane-slot enums — still used by the fixed-pane Search tab. */
export enum PaneSlot {
	PARENT = 0, // depth-tabs: center/current; Search: input
	CURRENT = 1, // Search: results
	PREVIEW = 2, // Search: detail
}

export type PaneId = number; // 0-based index into the active tab's pane list

// ── Depth stack ──────────────────────────────────────────────────────────────
/** One frame in a tab's depth stack. `kind` identifies the list (page-defined,
 *  e.g. "feeds", "episodes:feedId", "settings:sections"); `focus` is the
 *  focused row index within that list. `ctx` optionally carries an id or
 *  payload the page needs to derive the list (e.g. a feed id). */
export type DepthFrame = {
	kind: string;
	ctx?: string;
	focus: number;
};

// ── Selection store ───────────────────────────────────────────────────────────
// A Set per (tab, paneKey). `paneKey` is a string each pane uses to namespace
// its selection (e.g. "myshows:episodes"). Visual mode toggles into range
// selection anchored at the focused index.

type SelectionMap = Record<string, Set<string>>;

const HAS_VISUAL = (mode: NavMode) => mode === NavMode.VISUAL;

export const { use: useNavigation, provider: NavigationProvider } =
	createSimpleContext({
		name: "Navigation",
		init: () => {
			const [activeTab, setActiveTab] = createSignal<TABS>(TABS.FEED);
			// App focus starts on the left tab sidebar (root pane); tab switches
			// also return focus there.
			const [activePane, setActivePane] = createSignal<PaneId>(SIDEBAR_PANE);
			const [mode, setMode] = createSignal<NavMode>(NavMode.NORMAL);
			const [count, setCount] = createSignal<number | null>(null);
			const [inputFocused, setInputFocused] = createSignal(false);

			// per-tab depth stack. Depth-tabs get a root frame on first visit.
			const [stacks, setStacks] = createSignal<
				Partial<Record<TABS, DepthFrame[]>>
			>({ [TABS.FEED]: [rootFrameFor(TABS.FEED)] });

			// per-pane focused index (for j/k movement in fixed-pane tabs). Keyed
			// by `${tab}:${pane}`. Depth-tabs read/write the top frame's `focus`
			// for pane 0 (DEPTH_CENTER_PANE) instead.
			const [paneIndices, setPaneIndices] = createSignal<
				Record<string, number>
			>({});
			const [selections, setSelections] = createSignal<SelectionMap>({});
			const [visualAnchor, setVisualAnchor] = createSignal<{
				paneKey: string;
				index: number;
			} | null>(null);

			const [commandBuffer, setCommandBuffer] = createSignal("");
			const [commandError, setCommandError] = createSignal<string | null>(null);

			/** Depth stack for a tab (empty for fixed-pane tabs). */
			const depthStackFor = (tab: TABS = activeTab()) => stacks()[tab] ?? [];

			const ensureStack = (tab: TABS) => {
				if (DEPTH_TABS.has(tab) && depthStackFor(tab).length === 0) {
					setStacks((s) => ({ ...s, [tab]: [rootFrameFor(tab)] }));
				}
			};

			// On tab change: ensure a root frame exists (depth-tabs) + reset
			// focus to the sidebar, clear modes/command/visual state.
			createEffect(
				on(activeTab, (tab) => {
					ensureStack(tab);
					batch(() => {
						setActivePane(SIDEBAR_PANE);
						setMode(NavMode.NORMAL);
						setCount(null);
						setCommandBuffer("");
						setCommandError(null);
						setVisualAnchor(null);
					});
				}),
			);

			// ── depth stack accessors ──────────────────────────────────────────────
			const depthStack = createMemo<DepthFrame[]>(() =>
				depthStackFor(activeTab()),
			);
			const currentDepth = createMemo(() =>
				Math.max(0, depthStack().length - 1),
			);
			const topFrame = createMemo<DepthFrame | undefined>(
				() => depthStack()[depthStack().length - 1],
			);
			const isDepthTab = () => DEPTH_TABS.has(activeTab());

			/** Focus within a given depth's frame (default = current/top). */
			const depthFocus = (d: number = currentDepth()) =>
				depthStack()[d]?.focus ?? 0;

			const setDepthFocus = (i: number, d: number = currentDepth()) =>
				setStacks((s) => {
					const st = s[activeTab()];
					if (!st || d < 0 || d >= st.length) return s;
					const next = st.slice();
					next[d] = { ...next[d], focus: i };
					return { ...s, [activeTab()]: next };
				});

			/** Push a child frame (drill in). */
			const pushDepth = (frame: DepthFrame) =>
				setStacks((s) => {
					const st = s[activeTab()] ?? [];
					return { ...s, [activeTab()]: [...st, frame] };
				});

			/** Pop the top frame (go back up a depth). No-op at root. Returns
			 *  true if a frame was popped. */
			const popDepth = (): boolean => {
				let popped = false;
				setStacks((s) => {
					const st = s[activeTab()] ?? [];
					if (st.length <= 1) return s;
					popped = true;
					return { ...s, [activeTab()]: st.slice(0, -1) };
				});
				return popped;
			};

			// ── tab switching ──────────────────────────────────────────────────────
			const gotoTab = (tab: TABS) => {
				if (tab < 1 || tab > TabsCount) return;
				setActiveTab(tab);
			};
			const nextTab = () =>
				setActiveTab((t) => (t >= TabsCount ? 1 : ((t + 1) as TABS)));
			const prevTab = () =>
				setActiveTab((t) => (t <= 1 ? TabsCount : ((t - 1) as TABS)));

			// ── pane focus ──────────────────────────────────────────────────────────
			const setPane = (pane: PaneId) => setActivePane(pane);

			/** Move focus to the adjacent pane (fixed-pane tabs only). `dir` =
			 *  -1 (left, toward sidebar) or +1 (right, toward preview). Clamped to
			 *  [SIDEBAR_PANE, paneCount-1]. */
			const swipe = (dir: -1 | 1, paneCount: number) => {
				setActivePane((p) => {
					const n = Math.max(SIDEBAR_PANE, Math.min(paneCount - 1, p + dir));
					return n;
				});
			};

			// ── per-pane focus index ────────────────────────────────────────────────
			const paneKey = (pane: PaneId = activePane()) => `${activeTab()}:${pane}`;

			/** For depth-tabs, pane 0 (center) reads/writes the top frame's
			 *  focus. The sidebar pane's focus IS the active tab. Other panes
			 *  (and fixed-pane tabs) use the per-pane map. */
			const focusedIndex = (pane: PaneId = activePane()): number => {
				if (pane === SIDEBAR_PANE) return activeTab() - 1;
				if (isDepthTab() && pane === DEPTH_CENTER_PANE) {
					return topFrame()?.focus ?? 0;
				}
				return paneIndices()[paneKey(pane)] ?? 0;
			};

			const setFocusedIndex = (pane: PaneId, index: number) => {
				if (pane === SIDEBAR_PANE) {
					gotoTab(((index + TabsCount) % TabsCount) + 1);
					return;
				}
				if (isDepthTab() && pane === DEPTH_CENTER_PANE) {
					setDepthFocus(index);
					return;
				}
				setPaneIndices((m) => ({
					...m,
					[`${activeTab()}:${pane}`]: index,
				}));
			};

			/** Apply a clamped relative motion to the active pane's focus. Returns
			 *  the new index so callers can update their own scroll state. */
			const move = (
				delta: number,
				listLen: number,
				countOverride?: number,
			): number => {
				if (listLen <= 0) return 0;
				const steps = countOverride ?? count() ?? 1;
				const pane = activePane();
				const cur = focusedIndex(pane);
				let next = cur + delta * steps;
				// wrap-around like yazi (arrow wraps top<->bottom)
				next = ((next % listLen) + listLen) % listLen;
				setFocusedIndex(pane, next);
				// visual-mode range selection: add newly-traversed items to selection
				if (HAS_VISUAL(mode()) && visualAnchor()) {
					growVisualSelection(next);
				}
				return next;
			};

			const gotoIndex = (index: number, listLen: number): number => {
				if (listLen <= 0) return 0;
				const pane = activePane();
				const next = Math.max(0, Math.min(listLen - 1, index));
				setFocusedIndex(pane, next);
				if (HAS_VISUAL(mode()) && visualAnchor()) growVisualSelection(next);
				return next;
			};

			// ── selection ───────────────────────────────────────────────────────────
			const selSet = (key: string): Set<string> =>
				selections()[key] ?? new Set();

			const toggleSelected = (id: string) => {
				const key = paneKey();
				setSelections((m) => {
					const set = new Set(m[key] ?? []);
					if (set.has(id)) set.delete(id);
					else set.add(id);
					return { ...m, [key]: set };
				});
			};

			const isSelected = (id: string) => selSet(paneKey()).has(id);

			const clearSelection = (key?: string) => {
				const k = key ?? paneKey();
				setSelections((m) => {
					if (!(k in m)) return m;
					const next = { ...m };
					delete next[k];
					return next;
				});
			};

			const selectedIds = createMemo(() => [...selSet(paneKey())]);

			/** Enter visual mode, anchoring range selection at the current focus. */
			const enterVisual = () => {
				const pane = activePane();
				setVisualAnchor({ paneKey: paneKey(pane), index: focusedIndex(pane) });
				setMode(NavMode.VISUAL);
			};

			/** Grow selection between the visual anchor and `index` for the active
			 *  pane. Callers pass item ids aligned to indices; we store ids via the
			 *  resolve callback registered per-pane (see registerResolver). */
			let resolvers: Record<string, (index: number) => string | undefined> = {};
			const registerResolver = (
				key: string,
				fn: (i: number) => string | undefined,
			) => {
				resolvers[key] = fn;
			};
			const growVisualSelection = (index: number) => {
				const anchor = visualAnchor();
				if (!anchor) return;
				const resolve = resolvers[anchor.paneKey];
				if (!resolve) return;
				const lo = Math.min(anchor.index, index);
				const hi = Math.max(anchor.index, index);
				const ids: string[] = [];
				for (let i = lo; i <= hi; i++) {
					const id = resolve(i);
					if (id) ids.push(id);
				}
				const key = anchor.paneKey;
				setSelections((m) => ({ ...m, [key]: new Set(ids) }));
			};

			// ── modes ────────────────────────────────────────────────────────────────
			const enterCommand = () => {
				setMode(NavMode.COMMAND);
				setCommandBuffer("");
				setCommandError(null);
			};
			const enterInput = () => setMode(NavMode.INPUT);
			const exitCommand = () => {
				batch(() => {
					setMode(NavMode.NORMAL);
					setCommandBuffer("");
					setCommandError(null);
				});
			};
			const exitVisual = () => {
				batch(() => {
					setMode(NavMode.NORMAL);
					setVisualAnchor(null);
				});
			};
			const toNormal = () => {
				if (mode() === NavMode.VISUAL) {
					clearSelection();
					exitVisual();
				} else {
					setMode(NavMode.NORMAL);
				}
			};

			// ── command buffer ───────────────────────────────────────────────────────
			const appendCommand = (ch: string) => setCommandBuffer((b) => b + ch);
			const backspaceCommand = () => setCommandBuffer((b) => b.slice(0, -1));
			const submitCommand = (): string => {
				const cmd = commandBuffer().trim();
				exitCommand();
				return cmd;
			};

			// ── count register ───────────────────────────────────────────────────────
			const pushCountDigit = (d: number) => setCount((c) => (c ?? 0) * 10 + d);
			const consumeCount = (): number => {
				const c = count();
				setCount(null);
				return c ?? 1;
			};

			return {
				activeTab,
				activePane,
				mode,
				count,
				inputFocused,
				commandBuffer,
				commandError,
				visualAnchor,
				selections,
				selectedIds,
				// depth stack
				depthStack,
				currentDepth,
				topFrame,
				depthFocus,
				setDepthFocus,
				pushDepth,
				popDepth,
				isDepthTab,
				// tab
				setActiveTab: gotoTab,
				nextTab,
				prevTab,
				// pane focus
				setActivePane: setPane,
				swipe,
				// focus index
				focusedIndex,
				setFocusedIndex,
				move,
				gotoIndex,
				// selection
				isSelected,
				toggleSelected,
				clearSelection,
				selectedIdsFor: (key: string) => [...selSet(key)],
				registerResolver,
				enterVisual,
				exitVisual,
				// modes
				setActiveTabSignal: setActiveTab,
				setActiveDepth: setPane, // legacy alias
				activeDepth: activePane, // legacy alias
				setInputFocused,
				nextPane: () => {}, // legacy noop; swipe() replaces this
				prevPane: () => {},
				setMode,
				enterCommand,
				enterInput,
				exitCommand,
				toNormal,
				// command buffer
				setCommandBuffer,
				appendCommand,
				backspaceCommand,
				submitCommand,
				setCommandError,
				// count
				pushCountDigit,
				consumeCount,
			};
		},
	});
