import { DiscoverPage } from "@/pages/Discover/DiscoverPage";
import { FeedPage, FeedPaneCount } from "@/pages/Feed/FeedPage";
import { MyShowsPage, MyShowsPaneCount } from "@/pages/MyShows/MyShowsPage";
import { PlayerPage } from "@/pages/Player/PlayerPage";
import { SearchPage } from "@/pages/Search/SearchPage";
import { SettingsPage } from "@/pages/Settings/SettingsPage";

export enum TABS {
  FEED,
  MYSHOWS,
  DISCOVER,
  SEARCH,
  PLAYER,
  SETTINGS,
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
  [TABS.SETTINGS]: SettingPaneCount,
};
