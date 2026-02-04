import { createSignal } from "solid-js"
import { Layout } from "./components/Layout"
import { Navigation } from "./components/Navigation"
import { TabNavigation } from "./components/TabNavigation"
import { SyncPanel } from "./components/SyncPanel"
import { FeedList } from "./components/FeedList"
import { LoginScreen } from "./components/LoginScreen"
import { CodeValidation } from "./components/CodeValidation"
import { OAuthPlaceholder } from "./components/OAuthPlaceholder"
import { SyncProfile } from "./components/SyncProfile"
import { SearchPage } from "./components/SearchPage"
import { DiscoverPage } from "./components/DiscoverPage"
import { useAuthStore } from "./stores/auth"
import { useFeedStore } from "./stores/feed"
import { FeedVisibility } from "./types/feed"
import { useAppKeyboard } from "./hooks/useAppKeyboard"
import type { TabId } from "./components/Tab"
import type { AuthScreen } from "./types/auth"

export function App() {
  const [activeTab, setActiveTab] = createSignal<TabId>("discover")
  const [authScreen, setAuthScreen] = createSignal<AuthScreen>("login")
  const [showAuthPanel, setShowAuthPanel] = createSignal(false)
  const [inputFocused, setInputFocused] = createSignal(false)
  const auth = useAuthStore()
  const feedStore = useFeedStore()

  // Centralized keyboard handler for all tab navigation and shortcuts
  useAppKeyboard({
    get activeTab() { return activeTab() },
    onTabChange: setActiveTab,
    inputFocused: inputFocused(),
    onAction: (action) => {
      if (action === "escape") {
        setShowAuthPanel(false)
        setInputFocused(false)
      }
    },
  })

  const renderContent = () => {
    const tab = activeTab()

    switch (tab) {
      case "feeds":
        return (
          <FeedList
            focused={true}
            showEpisodeCount={true}
            showLastUpdated={true}
            onOpenFeed={(feed) => {
              // Would open feed detail view
            }}
          />
        )

      case "settings":
        // Show auth panel or sync panel based on state
        if (showAuthPanel()) {
          if (auth.isAuthenticated) {
            return (
              <SyncProfile
                focused={true}
                onLogout={() => {
                  auth.logout()
                  setShowAuthPanel(false)
                }}
                onManageSync={() => setShowAuthPanel(false)}
              />
            )
          }

          switch (authScreen()) {
            case "code":
              return (
                <CodeValidation
                  focused={true}
                  onBack={() => setAuthScreen("login")}
                />
              )
            case "oauth":
              return (
                <OAuthPlaceholder
                  focused={true}
                  onBack={() => setAuthScreen("login")}
                  onNavigateToCode={() => setAuthScreen("code")}
                />
              )
            case "login":
            default:
              return (
                <LoginScreen
                  focused={true}
                  onNavigateToCode={() => setAuthScreen("code")}
                  onNavigateToOAuth={() => setAuthScreen("oauth")}
                />
              )
          }
        }

        return (
          <box flexDirection="column" gap={1}>
            <SyncPanel />
            <box height={1} />
            <box border padding={1}>
              <box flexDirection="row" gap={2}>
                <text fg="gray">Account:</text>
                {auth.isAuthenticated ? (
                  <text fg="green">Signed in as {auth.user?.email}</text>
                ) : (
                  <text fg="yellow">Not signed in</text>
                )}
                <box
                  border
                  padding={0}
                  onMouseDown={() => setShowAuthPanel(true)}
                >
                  <text fg="cyan">
                    {auth.isAuthenticated ? "[A] Account" : "[A] Sign In"}
                  </text>
                </box>
              </box>
            </box>
          </box>
        )

      case "discover":
        return (
          <DiscoverPage focused={!inputFocused()} />
        )

      case "search":
        return (
          <SearchPage
            focused={!inputFocused()}
            onInputFocusChange={setInputFocused}
            onSubscribe={(result) => {
              const feeds = feedStore.feeds()
              const alreadySubscribed = feeds.some(
                (feed) =>
                  feed.podcast.id === result.podcast.id ||
                  feed.podcast.feedUrl === result.podcast.feedUrl
              )

              if (!alreadySubscribed) {
                feedStore.addFeed(
                  { ...result.podcast, isSubscribed: true },
                  result.sourceId,
                  FeedVisibility.PUBLIC
                )
              }
            }}
          />
        )

      case "player":
      default:
        return (
          <box border style={{ padding: 2 }}>
            <text>
              <strong>{tab}</strong>
              <br />
              Player - coming in later phases
            </text>
          </box>
        )
    }
  }

  return (
    <Layout
      header={
        <TabNavigation activeTab={activeTab()} onTabSelect={setActiveTab} />
      }
      footer={
        <Navigation activeTab={activeTab()} onTabSelect={setActiveTab} />
      }
    >
      <box style={{ padding: 1 }}>{renderContent()}</box>
    </Layout>
  )
}
