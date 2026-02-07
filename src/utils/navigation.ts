enum FEEDTABTYPE {
  LATEST,
}
export const FeedTab = {
  [FEEDTABTYPE.LATEST]: {
    size: 1,
    title: "Feed - Latest Episodes",
    scrolling: true,
  },
};
enum MYSHOWSTYPE {
  SHOWLIST,
  EPISODELIST,
}
export const MyShowsTab = {
  [MYSHOWSTYPE.SHOWLIST]: { size: 0.3, title: "My Shows", scrolling: true },
  [MYSHOWSTYPE.EPISODELIST]: {
    size: 0.7,
    title: "<SHOW> - Episodes",
    scrolling: true,
  },
};

enum DiscoverTab {
  CATEGORIES,
  CATEGORYLIST,
}

export enum CATEGORIES {
  ALL,
  TECHNOLOGY,
  SCIENCE,
  COMEDY,
  NEWS,
  BUSINESS,
  HEALTH,
  EDUCATION,
  SPORTS,
  TRUECRIME,
  ARTS,
}
export const SearchTab = [];

export const PlayerTab = [];

export const SettingsTab = [];

export enum TABS {
  FEED,
  MYSHOWS,
  DISCOVER,
  SEARCH,
  PLAYER,
  SETTINGS,
}

export const LayerGraph = {
  [TABS.FEED]: FeedTab,
  [TABS.MYSHOWS]: MyShowsTab,
  [TABS.DISCOVER]: DiscoverTab,
  [TABS.SEARCH]: SearchTab,
  [TABS.PLAYER]: PlayerTab,
  [TABS.SETTINGS]: SettingsTab,
};
