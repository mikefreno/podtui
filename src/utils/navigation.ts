import { DiscoverPage, DiscoverPaneCount } from "@/pages/Discover/DiscoverPage";
import { FeedPage, FeedPaneCount } from "@/pages/Feed/FeedPage";
import { MyShowsPage, MyShowsPaneCount } from "@/pages/MyShows/MyShowsPage";
import { PlayerPage, PlayerPaneCount } from "@/pages/Player/PlayerPage";
import { SearchPage, SearchPaneCount } from "@/pages/Search/SearchPage";
import { SettingsPage, SettingsPaneCount } from "@/pages/Settings/SettingsPage";

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
 *  columns, infinite drill via push/pop). Search and Player keep the legacy
 *  fixed-pane model. */
export const DEPTH_TABS: ReadonlySet<TABS> = new Set([
	TABS.FEED,
	TABS.MYSHOWS,
	TABS.DISCOVER,
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
		case TABS.SETTINGS:
			return { kind: "settings:sections", focus: 0 };
		default:
			return { kind: "root", focus: 0 };
	}
}

export const LayerGraph = {
	[TABS.FEED]: FeedPage,
	[TABS.MYSHOWS]: MyShowsPage,
	[TABS.DISCOVER]: DiscoverPage,
	[TABS.SEARCH]: SearchPage,
	[TABS.PLAYER]: PlayerPage,
	[TABS.SETTINGS]: SettingsPage,
};
export const LayerDepths = {
	[TABS.FEED]: FeedPaneCount,
	[TABS.MYSHOWS]: MyShowsPaneCount,
	[TABS.DISCOVER]: DiscoverPaneCount,
	[TABS.SEARCH]: SearchPaneCount,
	[TABS.PLAYER]: PlayerPaneCount,
	[TABS.SETTINGS]: SettingsPaneCount,
};

// Yazi-style pane grow ratios (parent : current : preview) ≈ [1, 4, 3].
// Panes use flexGrow (Yoga) so columns always sum to the row width regardless
// of terminal size — more robust than fixed percentages and exactly mirrors
// yazi's `mgr.ratio` config. Set a slot's ratio to 0 to hide it (2-pane tabs).
export const PANE_RATIO = {
	parent: 1,
	current: 4,
	preview: 3,
} as const;

// Number of interactive panes per tab. Depth-tabs (Feed/MyShows/Discover/
// Settings) now have a single focusable content pane (the center/current
// column at depth 0..N); prev and preview are derived, not focusable. Search
// keeps its 3 fixed panes; Player is single-pane. The Shell's h/l dispatch
// routes depth-tabs to push/pop instead of pane swipe. Defined here (after
// TABS) to avoid re-introducing the old NavigationContext top-level-init
// circular deadlock.
export const TabPaneCount: Record<TABS, number> = {
	[TABS.FEED]: 1, // depth: feeds → episodes → preview
	[TABS.MYSHOWS]: 1, // depth: shows → episodes → preview
	[TABS.DISCOVER]: 1, // depth: categories → results → preview
	[TABS.SEARCH]: 3, // fixed: query | results | detail
	[TABS.PLAYER]: 1, // single pane
	[TABS.SETTINGS]: 1, // depth: sections → items → editor
};
