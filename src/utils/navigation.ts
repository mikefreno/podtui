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
