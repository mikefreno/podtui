/**
 * navigation-store — the yazi-style navigation model, as a plain Solid store.
 *
 * This module is deliberately free of JSX and of any `.tsx` page imports so it
 * can be exercised directly by unit tests (`bun test`) without the OpenTUI JSX
 * runtime (which is supplied only by the build-time @opentui/solid bun-plugin).
 * The Solid provider wrapper (`useNavigation` / `NavigationProvider`) and the
 * simple-context plumbing live in `NavigationContext.tsx`; the app imports the
 * provider from there, tests import `createNavigation` directly from here.
 *
 * ── Model ────────────────────────────────────────────────────────────────
 * The app horizontally lays out three columns per tab:
 *
 *        parent  |  current  |  preview
 *
 * Layout ratios (1/7 : 3/7 : 3/7 in the final remake) live in
 * `@/utils/navigation` (PANE_RATIO). This module owns only the *focusable*
 * nav model — which column is focused and where its list cursor lives. The
 * parent/preview columns are always derived, never focused.
 *
 * Two pane models coexist under a single TAB list:
 *
 *  • The tab list is the flow's leading pane (TAB_PANE = 0) — a normal,
 *    focusable pane at the left of every tab's content, just like in yazi.
 *    Starting focus lives here; tab switches made from here keep focus here.
 *    When it is focused, j/k moves the tab cursor (`tabCursor`) and
 *    `l`/Enter opens the hovered tab into its content. Swiping left past
 *    it goes out of the panes (inert — there is no pane beyond it).
 *
 *  • Depth-stack tabs (Feed, MyShows, Discover, Settings) expose exactly ONE
 *    focusable content pane — the current column (DEPTH_CENTER_PANE = 1). The
 *    parent column renders the previous depth's list (blank at depth 0); the
 *    preview column renders the hovered item. `l`/Enter drills in (push a
 *    frame); `h` pops a depth. Depth is unbounded. At depth 0 `h` moves focus
 *    to the tab list (TAB_PANE).
 *
 *  • Fixed-pane tabs (Search = input/results/detail, Player = single) keep the
 *    indexed pane model — `focusedIndex(pane)` + `swipe` — moving between the
 *    parent/current/preview columns with `h`/`l`, clamped to
 *    [1, paneCount]; `h` on the first content pane (1) moves focus to the tab
 *    list; `h` on the tab list stays out-of-panear (inert).
 *
 * Tabs switch via the tab list (j/k), digit keys `1`-`6`, and `[`/`]`.
 * Focus on the tab list persists across a tab switch; from there `l`/Enter
 * drops into the active tab's content (panes 1..N).
 */
import { createSignal, batch } from "solid-js";
import { TABS, TabsCount, DEPTH_TABS, rootFrameFor } from "@/utils/navigation";

export enum NavMode {
	NORMAL = "NORMAL",
	VISUAL = "VISUAL",
	COMMAND = "COMMAND",
	INPUT = "INPUT",
}

/** The current content pane of the active tab, i.e. the focusable column
 *  (index 1) for depth-tabs, and the default landing pane for fixed-pane
 *  tabs. Content panes occupy 1..n; the tab list is pane 0. A tab switch made
 *  while focused on content resets `activePane` to this pane (unless already
 *  on the tab list). */
export const DEPTH_CENTER_PANE = 1 as PaneId;

/** The tab list — the leading pane (pane 0) of the tab flow, rendered to the
 *  left of the active tab's content (1..n). It is the app's outermost pane:
 *  starting focus lives here, tab switches made from it keep focus on it, and
 *  swiping left past the first content pane returns to it. Swiping left again
 *  — beyond it — goes out of the panes (no-op). While it is focused, j/k
 *  moves the tab cursor and `l`/Enter opens the hovered tab's content. */
/** Content pane slots for fixed-pane tabs (Search). Values are the global
 *  pane indices (content starts at 1). */
export enum PaneSlot {
	PARENT = 1, // Search: input
	CURRENT = 2, // Search: results
	PREVIEW = 3, // Search: detail
}

export type PaneId = number; // 0 = tab list; 1..n = the active tab's content panes

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

/**
 * Construct a fresh, self-contained navigation state graph.
 *
 * Exported (not just inlined into the Solid provider) so unit tests can build
 * a nav graph inside a `createRoot` without rendering any provider tree.
 */
export function createNavigation() {
	const [activeTab, setActiveTab] = createSignal<TABS>(TABS.FEED);
	// The root tab panel's cursor — which tab j/k is currently hovering. It is
	// independent of `activeTab` until l/Enter activates it (activateTabCursor)
	// or a direct tab switch (digits / [ ]) re-syncs it. So the panel behaves
	// just like any other yazi list: j/k move the cursor, Enter/l open.
	const [tabCursorSignal, setTabCursor] = createSignal<TABS>(TABS.FEED);
	// App focus starts on the tab list (the app root). `activePane` drives the
	// fixed-pane pages (Search/Player) and each page's content focus ring;
	// depth-tab focus is instead described by the per-tab depth stack plus the
	// `atRootTab` flag (the tab sits as the CURRENT pane when at the root, and
	// slides into the UP/parent pane once content is opened).
	const [activePane, setActivePane] = createSignal<PaneId>(DEPTH_CENTER_PANE);
	// Whether focus is on the tab-list root view — the tab is the CURRENT pane
	// with nothing above it. Opening a tab moves it to UP; deeper goes back out.
	const [atRootTabSignal, setAtTabRoot] = createSignal(true);
	const [mode, setMode] = createSignal<NavMode>(NavMode.NORMAL);
	const [count, setCount] = createSignal<number | null>(null);
	const [inputFocused, setInputFocused] = createSignal(false);

	// per-tab depth stack. Depth-tabs get a root frame on first visit.
	const [stacks, setStacks] = createSignal<Partial<Record<TABS, DepthFrame[]>>>(
		{ [TABS.FEED]: [rootFrameFor(TABS.FEED)] },
	);

	// per-pane focused index (for j/k movement in fixed-pane tabs). Keyed
	// by `${tab}:${pane}`. Depth-tabs read/write the top frame's `focus`
	// for pane 0 (DEPTH_CENTER_PANE) instead.
	const [paneIndices, setPaneIndices] = createSignal<Record<string, number>>(
		{},
	);
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

	/** Apply all tab-switch side effects synchronously. Done here in the
	 *  imperative `switchTab` path rather than a reactive `createEffect`
	 *  because this module is exercised by unit tests without the OpenTUI
	 *  JSX runtime, and in that environment Solid's `createEffect` is a
	 *  no-op (server build). Routing every tab change through this helper
	 *  keeps the behavior identical under both runtimes.
	 *
	 *  - when switching to a special (fixed-pane) tab from the tab root, leave the
	 *    root — those tabs render only their content, never the tab-list view.
	 *  - keep focus on the tab root if it is focused (depth-tab switch),
	 *    otherwise recenter on the active tab's current/center pane
	 *  - clear mode/command/visual/count state */
	const applyTabSwitch = (tab: TABS) => {
		ensureStack(tab);
		batch(() => {
			// A depth-tab switch from the root keeps the root; switching to a
			// special (fixed-pane) tab always leaves it. Switches made from
			// inside content drop into the new tab's content pane.
			if (atRootTabSignal() && !DEPTH_TABS.has(tab)) {
				setAtTabRoot(false);
			}
			if (!atRootTabSignal()) {
				setActivePane(DEPTH_CENTER_PANE);
			}
			setMode(NavMode.NORMAL);
			setCount(null);
			setCommandBuffer("");
			setCommandError(null);
			setVisualAnchor(null);
		});
	};

	// ── depth stack accessors ──────────────────────────────────────────────
	// Plain functions (not createMemo) so they recompute on every read.
	// On the client build these are read inside reactive JSX contexts so
	// their underlying signal reads are still tracked; on the server build
	// (used by unit tests) createMemo is a no-op that freezes at creation,
	// so a plain function is the only option that stays correct in tests.
	const depthStack = (): DepthFrame[] => depthStackFor(activeTab());
	const currentDepth = (): number => Math.max(0, depthStack().length - 1);
	const topFrame = (): DepthFrame | undefined =>
		depthStack()[depthStack().length - 1];
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
	/** Internal: set activeTab + run all side effects (root-frame seed,
	 *  pane/mode/command reset). Called by gotoTab/nextTab/prevTab so every
	 *  tab change — programmatic or key-driven — goes through one path. */
	const switchTab = (tab: TABS) => {
		setActiveTab(tab);
		// a direct tab switch re-syncs the root panel's cursor so the panel
		// reflects what is actually active.
		setTabCursor(tab);
		applyTabSwitch(tab);
	};
	const gotoTab = (tab: TABS) => {
		if (tab < 1 || tab > TabsCount) return;
		switchTab(tab);
	};
	const nextTab = () => {
		const t = activeTab() >= TabsCount ? 1 : ((activeTab() + 1) as TABS);
		switchTab(t);
	};
	const prevTab = () => {
		const t = activeTab() <= 1 ? TabsCount : ((activeTab() - 1) as TABS);
		switchTab(t);
	};

	// ── pane focus ──────────────────────────────────────────────────────────
	const setPane = (pane: PaneId) => setActivePane(pane);

	/** Move focus to the adjacent content pane (fixed-pane tabs only). `dir` =
	 *  -1 (left, toward parent) or +1 (right, toward preview). Clamped to
	 *  [0, paneCount-1]. The root panel transition (from content pane 0 to
	 *  (1..TabPaneCount) is handled by the dispatcher, not here. */
	const swipe = (dir: -1 | 1, paneCount: number) => {
		setActivePane((p) => {
			const n = Math.max(1, Math.min(paneCount, p + dir));
			return n;
		});
	};

	// ── tab root (the app's outermost pane) ──────────────────────────────────
	/** True while focus is on the tab list as the CURRENT pane — the app root,
	 *  with nothing above it. Only depth-tabs (Feed/MyShows/Discover/Settings)
	 *  participate; Search & Player are special and always show their content. */
	const atRootTab = (): boolean =>
		atRootTabSignal() && DEPTH_TABS.has(activeTab());

	/** Open the active tab's content: the tab slides from CURRENT into the
	 *  UP/parent pane and focus lands on the content's current pane. */
	const enterTabContent = () => {
		setAtTabRoot(false);
		setActivePane(DEPTH_CENTER_PANE);
	};

	/** Move focus back to the tab list root (UP -> CURRENT), e.g. `h` popping
	 *  out of content at depth 0. */
	const backToTabRoot = () => {
		setAtTabRoot(true);
		setActivePane(DEPTH_CENTER_PANE);
	};

	/** The tab the root's cursor is hovering (independent of activeTab). */
	const tabCursor = (): TABS => tabCursorSignal();

	/** Move the root's cursor to the adjacent tab (clamped, no wrap). */
	const moveTabCursor = (dir: -1 | 1) => {
		setTabCursor((c) => Math.max(1, Math.min(TabsCount, c + dir)) as TABS);
	};

	/** Open the hovered tab (switch to it and enter its content) from the root.
	 *  The yazi "open" of a tab row. */
	const activateTabCursor = () => {
		switchTab(tabCursorSignal());
		enterTabContent();
	};

	// ── per-pane focus index ────────────────────────────────────────────────
	const paneKey = (pane: PaneId = activePane()) => `${activeTab()}:${pane}`;

	/** For depth-tabs, pane 0 (the center/current pane) reads/writes
	 *  the top frame's focus. Other panes and fixed-pane tabs use the
	 *  per-pane index map. */
	const focusedIndex = (pane: PaneId = activePane()): number => {
		if (isDepthTab() && pane === DEPTH_CENTER_PANE) {
			return topFrame()?.focus ?? 0;
		}
		return paneIndices()[paneKey(pane)] ?? 0;
	};

	const setFocusedIndex = (pane: PaneId, index: number) => {
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
	const selSet = (key: string): Set<string> => selections()[key] ?? new Set();

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

	const selectedIds = () => [...selSet(paneKey())];

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
		// tab root (app's outermost pane)
		atRootTab,
		enterTabContent,
		backToTabRoot,
		tabCursor,
		moveTabCursor,
		activateTabCursor,
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
}

export type NavigationState = ReturnType<typeof createNavigation>;
