export enum DIRECTION {
	Increment,
	Decrement,
}

export enum TABS {
	FEED = 1,
	MYSHOWS = 2,
	DISCOVER = 3,
	SEARCH = 4,
	PLAYER = 5,
	SETTINGS = 6,
}
export const TabsCount = 6;

/** Tabs that use the yazi depth-stack model (prev | current | preview
 *  columns, infinite drill via push/pop). Search drills query→results, and
 *  Player drills into its single now-playing pane under the tab list (the
 *  parent=/tabs, current=player, preview hidden). */
export const DEPTH_TABS: ReadonlySet<TABS> = new Set([
	TABS.FEED,
	TABS.MYSHOWS,
	TABS.DISCOVER,
	TABS.SEARCH,
	TABS.PLAYER,
	TABS.SETTINGS,
]);

/** Root (depth-0) frame for a depth-tab — identifies the top-level list each
 *  page renders at root. Pages interpret the `kind` to derive their list. */
export function rootFrameFor(
	tab: TABS,
): import("@/context/NavigationContext").DepthFrame {
	switch (tab) {
		case TABS.FEED:
			return { kind: "feeds", focus: 0 };
		case TABS.MYSHOWS:
			return { kind: "shows", focus: 0 };
		case TABS.DISCOVER:
			return { kind: "discover:categories", focus: 0 };
		case TABS.SEARCH:
			return { kind: "search:query", focus: 0 };
		case TABS.PLAYER:
			return { kind: "player:nowplaying", focus: 0 };
		case TABS.SETTINGS:
			return { kind: "settings:sections", focus: 0 };
		default:
			return { kind: "root", focus: 0 };
	}
}

// Pane sizes are now user-resizable: the split positions (fractions of the
// row width) live in the shared pane-layout store (`@/stores/pane-layout`),
// which `PaneRow` consumes. `PANE_RATIO` was removed — see DEFAULT_PANE_SPLITS
// (0.2 / 0.7) for the historical 2:5:3 start.

// Number of *focusable* content panes per tab. The three visible columns
// (parent | current | preview) are a *render* concern, NOT three panes — for
// depth-tabs only the current column (index 0) is focusable, so this is 1.
// Every tab is now a depth-tab: each drills with `l` (push) and pops with `h`
// (returns to the tab root at depth 0) via the Shell dispatch. Defined here
// (after TABS) to avoid re-introducing the old NavigationContext top-level-
// init circular deadlock.
export const TabPaneCount: Record<TABS, number> = {
	[TABS.FEED]: 1, // depth: feeds → episodes → preview
	[TABS.MYSHOWS]: 1, // depth: shows → episodes → preview
	[TABS.DISCOVER]: 1, // depth: categories → results → preview
	[TABS.SEARCH]: 1, // depth: query → results, preview=detail
	[TABS.PLAYER]: 1, // depth: now-playing (2-pane, no preview)
	[TABS.SETTINGS]: 1, // depth: sections → items → editor
};
