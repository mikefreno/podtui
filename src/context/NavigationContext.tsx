import { createEffect, createSignal, on, batch, createMemo } from "solid-js";
import { createSimpleContext } from "./helper";
import { TABS, TabsCount } from "@/utils/navigation";

// ── Yazi-style navigation state ──────────────────────────────────────────────
// PodTui's interaction model after the yazi redesign. A single source of truth
// for: which tab is active, which pane within a tab is focused (parent |
// current | preview), the current mode (normal/visual/command/input), the
// count register (for `5j` style motions), and the command-bar buffer.
//
// Panes are addressed by index 0..N-1 within the active tab. Each tab declares
// how many panes it has via the PaneSystem registry (see navigation.ts). h/l
// (swipe-prev / swipe-next) move pane focus; j/k move within the focused pane's
// list (handled per-pane via the focusedIndex accessors below).

export enum NavMode {
	NORMAL = "NORMAL",
	VISUAL = "VISUAL",
	COMMAND = "COMMAND",
	INPUT = "INPUT",
}

/** Slot semantics mirror yazi's three columns. Slots beyond 2 exist for
 *  tabs that need more panes (e.g. search = query/results/detail). */
export enum PaneSlot {
	PARENT = 0, // left  — the container list (e.g. shows)
	CURRENT = 1, // middle — the items (e.g. episodes)
	PREVIEW = 2, // right — detail of the hovered item
}

export type PaneId = number; // 0-based index into the active tab's pane list

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
			const [activePane, setActivePane] = createSignal<PaneId>(
				PaneSlot.CURRENT,
			);
			const [mode, setMode] = createSignal<NavMode>(NavMode.NORMAL);
			const [count, setCount] = createSignal<number | null>(null);
			const [inputFocused, setInputFocused] = createSignal(false);

			// per-pane focused index (for j/k movement). Keyed by `${tab}:${pane}`.
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

			// Reset depth/pane/mode on tab change.
			createEffect(
				on(activeTab, () => {
					batch(() => {
						setActivePane(PaneSlot.CURRENT);
						setMode(NavMode.NORMAL);
						setCount(null);
						setCommandBuffer("");
						setCommandError(null);
						setVisualAnchor(null);
					});
				}),
			);

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

			/** Move focus to the adjacent pane. `dir` = -1 (left/parent) or +1
			 *  (right/preview). Clamped to [0, paneCount-1]. */
			const swipe = (dir: -1 | 1, paneCount: number) => {
				if (paneCount <= 1) return;
				setActivePane((p) => {
					const n = Math.max(0, Math.min(paneCount - 1, p + dir));
					return n;
				});
			};

			// ── per-pane focus index ────────────────────────────────────────────────
			const paneKey = (pane: PaneId = activePane()) => `${activeTab()}:${pane}`;

			const focusedIndex = (pane: PaneId = activePane()) =>
				paneIndices()[paneKey(pane)] ?? 0;

			const setFocusedIndex = (pane: PaneId, index: number) =>
				setPaneIndices((m) => ({ ...m, [`${activeTab()}:${pane}`]: index }));

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
