/**
 * layer-graph — maps each TAB id to its page component + pane count.
 *
 * Split out of `navigation.ts` so that the navigation primitives (TABS,
 * TabsCount, DEPTH_TABS, rootFrameFor, TabPaneCount) stay free of any
 * `.tsx` / JSX imports. This lets unit tests import the pure navigation
 * store without pulling the OpenTUI JSX runtime (which is only provided by
 * the build-time @opentui/solid bun-plugin).
 *
 * The page modules live alongside their pages and export `<count>PaneCount`
 * constants describing how many focusable panes each fixed page owns.
 */
import {
	DiscoverPage,
	DiscoverPaneCount,
} from "@/pages/Discover/DiscoverPage";
import { FeedPage, FeedPaneCount } from "@/pages/Feed/FeedPage";
import {
	MyShowsPage,
	MyShowsPaneCount,
} from "@/pages/MyShows/MyShowsPage";
import { PlayerPage, PlayerPaneCount } from "@/pages/Player/PlayerPage";
import { SearchPage, SearchPaneCount } from "@/pages/Search/SearchPage";
import {
	SettingsPage,
	SettingsPaneCount,
} from "@/pages/Settings/SettingsPage";
import { TABS } from "@/utils/navigation";

/** Maps a TAB id to the page component that renders it. */
export const LayerGraph = {
	[TABS.FEED]: FeedPage,
	[TABS.MYSHOWS]: MyShowsPage,
	[TABS.DISCOVER]: DiscoverPage,
	[TABS.SEARCH]: SearchPage,
	[TABS.PLAYER]: PlayerPage,
	[TABS.SETTINGS]: SettingsPage,
};

/** Per-tab focusable-pane counts (forwarded from each page's `*PaneCount`). */
export const LayerDepths = {
	[TABS.FEED]: FeedPaneCount,
	[TABS.MYSHOWS]: MyShowsPaneCount,
	[TABS.DISCOVER]: DiscoverPaneCount,
	[TABS.SEARCH]: SearchPaneCount,
	[TABS.PLAYER]: PlayerPaneCount,
	[TABS.SETTINGS]: SettingsPaneCount,
};
