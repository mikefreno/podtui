import { createSignal, ErrorBoundary } from "solid-js";
import { useSelectionHandler } from "@opentui/solid";
import { Layout } from "./components/Layout";
import { Navigation } from "./components/Navigation";
import { TabNavigation } from "./components/TabNavigation";
import { FeedPage } from "./components/FeedPage";
import { MyShowsPage } from "./components/MyShowsPage";
import { LoginScreen } from "./components/LoginScreen";
import { CodeValidation } from "./components/CodeValidation";
import { OAuthPlaceholder } from "./components/OAuthPlaceholder";
import { SyncProfile } from "./components/SyncProfile";
import { SearchPage } from "./components/SearchPage";
import { DiscoverPage } from "./components/DiscoverPage";
import { Player } from "./components/Player";
import { SettingsScreen } from "./components/SettingsScreen";
import { useAuthStore } from "./stores/auth";
import { useFeedStore } from "./stores/feed";
import { useAppStore } from "./stores/app";
import { useAudio } from "./hooks/useAudio";
import { useMultimediaKeys } from "./hooks/useMultimediaKeys";
import { FeedVisibility } from "./types/feed";
import { useAppKeyboard } from "./hooks/useAppKeyboard";
import { Clipboard } from "./utils/clipboard";
import { emit } from "./utils/event-bus";
import type { TabId } from "./components/Tab";
import type { AuthScreen } from "./types/auth";
import type { Episode } from "./types/episode";

export function App() {
  const [activeTab, setActiveTab] = createSignal<TabId>("feed");
  const [authScreen, setAuthScreen] = createSignal<AuthScreen>("login");
  const [showAuthPanel, setShowAuthPanel] = createSignal(false);
  const [inputFocused, setInputFocused] = createSignal(false);
  const [layerDepth, setLayerDepth] = createSignal(0);
  const auth = useAuthStore();
  const feedStore = useFeedStore();
  const appStore = useAppStore();
  const audio = useAudio();

  // Global multimedia key handling — active when Player tab is NOT
  // focused (Player.tsx handles its own keys when focused).
  useMultimediaKeys({
    playerFocused: () => activeTab() === "player" && layerDepth() > 0,
    inputFocused: () => inputFocused(),
    hasEpisode: () => !!audio.currentEpisode(),
  });

  const handlePlayEpisode = (episode: Episode) => {
    audio.play(episode);
    setActiveTab("player");
    setLayerDepth(1);
  };

  // My Shows page returns panel renderers
  const myShows = MyShowsPage({
    get focused() { return activeTab() === "shows" && layerDepth() > 0 },
    onPlayEpisode: (episode, feed) => {
      handlePlayEpisode(episode);
    },
    onExit: () => setLayerDepth(0),
  });

  // Centralized keyboard handler for all tab navigation and shortcuts
  useAppKeyboard({
    get activeTab() {
      return activeTab();
    },
    onTabChange: (tab: TabId) => {
      setActiveTab(tab);
      setInputFocused(false);
    },
    get inputFocused() { return inputFocused() },
    get navigationEnabled() { return layerDepth() === 0 },
    layerDepth,
    onLayerChange: (newDepth) => {
      setLayerDepth(newDepth);
    },
    onAction: (action) => {
      if (action === "escape") {
        if (layerDepth() > 0) {
          setLayerDepth(0);
          setInputFocused(false);
        } else {
          setShowAuthPanel(false);
          setInputFocused(false);
        }
      }

      if (action === "enter" && layerDepth() === 0) {
        setLayerDepth(1);
      }
    },
  });

  // Copy selected text to clipboard when selection ends (mouse release)
  useSelectionHandler((selection: any) => {
    if (!selection) return
    const text = selection.getSelectedText?.()
    if (!text || text.trim().length === 0) return

    Clipboard.copy(text).then(() => {
      emit("toast.show", {
        message: "Copied to clipboard",
        variant: "info",
        duration: 1500,
      })
    }).catch(() => {})
  })

  const getPanels = () => {
    const tab = activeTab();

    switch (tab) {
      case "feed":
        return {
          panels: [
            {
              title: "Feed - Latest Episodes",
              content: (
                <FeedPage
                  focused={layerDepth() > 0}
                  onPlayEpisode={(episode, feed) => {
                    handlePlayEpisode(episode);
                  }}
                  onExit={() => setLayerDepth(0)}
                />
              ),
            },
          ],
          activePanelIndex: 0,
          hint: "j/k navigate | Enter play | r refresh | Esc back",
        };

      case "shows":
        return {
          panels: [
            {
              title: "My Shows",
              width: 35,
              content: myShows.showsPanel(),
              focused: myShows.focusPane() === "shows",
            },
            {
              title: myShows.selectedShow()
                ? `${myShows.selectedShow()!.podcast.title} - Episodes`
                : "Episodes",
              content: myShows.episodesPanel(),
              focused: myShows.focusPane() === "episodes",
            },
          ],
          activePanelIndex: myShows.focusPane() === "shows" ? 0 : 1,
          hint: "h/l switch panes | j/k navigate | Enter play | r refresh | d unsubscribe | Esc back",
        };

      case "settings":
        if (showAuthPanel()) {
          if (auth.isAuthenticated) {
            return {
              panels: [{
                title: "Account",
                content: (
                  <SyncProfile
                    focused={layerDepth() > 0}
                    onLogout={() => {
                      auth.logout();
                      setShowAuthPanel(false);
                    }}
                    onManageSync={() => setShowAuthPanel(false)}
                  />
                ),
              }],
              activePanelIndex: 0,
              hint: "Esc back",
            };
          }

          const authContent = () => {
            switch (authScreen()) {
              case "code":
                return (
                  <CodeValidation
                    focused={layerDepth() > 0}
                    onBack={() => setAuthScreen("login")}
                  />
                );
              case "oauth":
                return (
                  <OAuthPlaceholder
                    focused={layerDepth() > 0}
                    onBack={() => setAuthScreen("login")}
                    onNavigateToCode={() => setAuthScreen("code")}
                  />
                );
              default:
                return (
                  <LoginScreen
                    focused={layerDepth() > 0}
                    onNavigateToCode={() => setAuthScreen("code")}
                    onNavigateToOAuth={() => setAuthScreen("oauth")}
                  />
                );
            }
          };

          return {
            panels: [{
              title: "Sign In",
              content: authContent(),
            }],
            activePanelIndex: 0,
            hint: "Esc back",
          };
        }

        return {
          panels: [{
            title: "Settings",
            content: (
              <SettingsScreen
                onOpenAccount={() => setShowAuthPanel(true)}
                accountLabel={
                  auth.isAuthenticated
                    ? `Signed in as ${auth.user?.email}`
                    : "Not signed in"
                }
                accountStatus={auth.isAuthenticated ? "signed-in" : "signed-out"}
                onExit={() => setLayerDepth(0)}
              />
            ),
          }],
          activePanelIndex: 0,
          hint: "j/k navigate | Enter select | Esc back",
        };

      case "discover":
        return {
          panels: [{
            title: "Discover",
            content: (
              <DiscoverPage
                focused={layerDepth() > 0}
                onExit={() => setLayerDepth(0)}
              />
            ),
          }],
          activePanelIndex: 0,
          hint: "Tab switch focus | j/k navigate | Enter subscribe | r refresh | Esc back",
        };

      case "search":
        return {
          panels: [{
            title: "Search",
            content: (
              <SearchPage
                focused={layerDepth() > 0}
                onInputFocusChange={setInputFocused}
                onExit={() => setLayerDepth(0)}
                onSubscribe={(result) => {
                  const feeds = feedStore.feeds();
                  const alreadySubscribed = feeds.some(
                    (feed) =>
                      feed.podcast.id === result.podcast.id ||
                      feed.podcast.feedUrl === result.podcast.feedUrl,
                  );

                  if (!alreadySubscribed) {
                    feedStore.addFeed(
                      { ...result.podcast, isSubscribed: true },
                      result.sourceId,
                      FeedVisibility.PUBLIC,
                    );
                  }
                }}
              />
            ),
          }],
          activePanelIndex: 0,
          hint: "Tab switch focus | / search | Enter select | Esc back",
        };

      case "player":
        return {
          panels: [{
            title: "Player",
            content: (
              <Player focused={layerDepth() > 0} onExit={() => setLayerDepth(0)} />
            ),
          }],
          activePanelIndex: 0,
          hint: "Space play/pause | Esc back",
        };

      default:
        return {
          panels: [{
            title: tab,
            content: (
              <box padding={2}>
                <text>Coming soon</text>
              </box>
            ),
          }],
          activePanelIndex: 0,
          hint: "",
        };
    }
  };

  return (
    <ErrorBoundary fallback={(err) => (
      <box border padding={2}>
        <text fg="red">
          Error: {err?.message ?? String(err)}{"\n"}
          Press a number key (1-6) to switch tabs.
        </text>
      </box>
    )}>
      <Layout
        header={
          <TabNavigation activeTab={activeTab()} onTabSelect={setActiveTab} />
        }
        footer={
          <box flexDirection="row" justifyContent="space-between" width="100%">
            <Navigation activeTab={activeTab()} onTabSelect={setActiveTab} />
            <text fg="gray">{getPanels().hint}</text>
          </box>
        }
        panels={getPanels().panels}
        activePanelIndex={getPanels().activePanelIndex}
      />
    </ErrorBoundary>
  );
}
