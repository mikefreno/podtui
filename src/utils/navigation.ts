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

// Number of interactive panes per tab (for the yazi h/l swipe). Slots beyond
// a tab's count are not focusable. Defined here (after TABS) to avoid re-introducing
// the old NavigationContext top-level-init circular deadlock.
export const TabPaneCount: Record<TABS, number> = {
	[TABS.FEED]: 3, // feeds | episodes | preview
	[TABS.MYSHOWS]: 3, // shows | episodes | preview
	[TABS.DISCOVER]: 3, // categories | results | detail
	[TABS.SEARCH]: 3, // query | results | detail
	[TABS.PLAYER]: 1, // single pane
	[TABS.SETTINGS]: 2, // sections | panel
};
