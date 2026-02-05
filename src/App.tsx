import { createSignal } from "solid-js";
import { Layout } from "./components/Layout";
import { Navigation } from "./components/Navigation";
import { TabNavigation } from "./components/TabNavigation";
import { FeedList } from "./components/FeedList";
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
import { FeedVisibility } from "./types/feed";
import { useAppKeyboard } from "./hooks/useAppKeyboard";
import type { TabId } from "./components/Tab";
import type { AuthScreen } from "./types/auth";

export function App() {
  const [activeTab, setActiveTab] = createSignal<TabId>("settings");
  const [authScreen, setAuthScreen] = createSignal<AuthScreen>("login");
  const [showAuthPanel, setShowAuthPanel] = createSignal(false);
  const [inputFocused, setInputFocused] = createSignal(false);
  const [layerDepth, setLayerDepth] = createSignal(0);
  const auth = useAuthStore();
  const feedStore = useFeedStore();
  const appStore = useAppStore();

  // Centralized keyboard handler for all tab navigation and shortcuts
  useAppKeyboard({
    get activeTab() {
      return activeTab();
    },
    onTabChange: setActiveTab,
    inputFocused: inputFocused(),
    navigationEnabled: layerDepth() === 0,
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

  const renderContent = () => {
    const tab = activeTab();

    switch (tab) {
      case "feeds":
        return (
          <FeedList
            focused={layerDepth() > 0}
            showEpisodeCount={true}
            showLastUpdated={true}
            onFocusChange={() => setLayerDepth(0)}
            onOpenFeed={(feed) => {
              // Would open feed detail view
            }}
          />
        );

      case "settings":
        // Show auth panel or sync panel based on state
        if (showAuthPanel()) {
          if (auth.isAuthenticated) {
            return (
              <SyncProfile
                focused={layerDepth() > 0}
                onLogout={() => {
                  auth.logout();
                  setShowAuthPanel(false);
                }}
                onManageSync={() => setShowAuthPanel(false)}
              />
            );
          }

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
            case "login":
            default:
              return (
                <LoginScreen
                  focused={layerDepth() > 0}
                  onNavigateToCode={() => setAuthScreen("code")}
                  onNavigateToOAuth={() => setAuthScreen("oauth")}
                />
              );
          }
        }

        return (
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
        );

      case "discover":
        return (
          <DiscoverPage
            focused={layerDepth() > 0}
            onExit={() => setLayerDepth(0)}
          />
        );

      case "search":
        return (
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
        );

      case "player":
        return (
          <Player focused={layerDepth() > 0} onExit={() => setLayerDepth(0)} />
        );

      default:
        return (
          <box border style={{ padding: 2 }}>
            <text>
              <strong>{tab}</strong>
              <br />
              Coming soon
            </text>
          </box>
        );
    }
  };

  return (
    <Layout
      layerDepth={layerDepth()}
      header={
        <TabNavigation activeTab={activeTab()} onTabSelect={setActiveTab} />
      }
      footer={<Navigation activeTab={activeTab()} onTabSelect={setActiveTab} />}
    >
      <box style={{ padding: 1 }}>{renderContent()}</box>
    </Layout>
  );
}
