import { createSignal } from "solid-js"
import { Layout } from "./components/Layout"
import { Navigation } from "./components/Navigation"
import { TabNavigation } from "./components/TabNavigation"
import { KeyboardHandler } from "./components/KeyboardHandler"
import { SyncPanel } from "./components/SyncPanel"
import { FeedList } from "./components/FeedList"
import { LoginScreen } from "./components/LoginScreen"
import { CodeValidation } from "./components/CodeValidation"
import { OAuthPlaceholder } from "./components/OAuthPlaceholder"
import { SyncProfile } from "./components/SyncProfile"
import { useAuthStore } from "./stores/auth"
import type { TabId } from "./components/Tab"
import type { Feed, FeedVisibility } from "./types/feed"
import type { AuthScreen } from "./types/auth"

// Mock data for demonstration
const MOCK_FEEDS: Feed[] = [
  {
    id: "1",
    podcast: {
      id: "p1",
      title: "The Daily Tech News",
      description: "Your daily dose of technology news and insights from around the world.",
      feedUrl: "https://example.com/tech.rss",
      lastUpdated: new Date(),
      isSubscribed: true,
    },
    episodes: [],
    visibility: "public" as FeedVisibility,
    sourceId: "rss",
    lastUpdated: new Date(),
    isPinned: true,
  },
  {
    id: "2",
    podcast: {
      id: "p2",
      title: "Code & Coffee",
      description: "Weekly discussions about programming, software development, and coffee.",
      feedUrl: "https://example.com/code.rss",
      lastUpdated: new Date(Date.now() - 86400000),
      isSubscribed: true,
    },
    episodes: [],
    visibility: "private" as FeedVisibility,
    sourceId: "rss",
    lastUpdated: new Date(Date.now() - 86400000),
    isPinned: false,
  },
  {
    id: "3",
    podcast: {
      id: "p3",
      title: "Science Explained",
      description: "Breaking down complex scientific topics for curious minds.",
      feedUrl: "https://example.com/science.rss",
      lastUpdated: new Date(Date.now() - 172800000),
      isSubscribed: true,
    },
    episodes: [],
    visibility: "public" as FeedVisibility,
    sourceId: "itunes",
    lastUpdated: new Date(Date.now() - 172800000),
    isPinned: false,
  },
]

export function App() {
  const [activeTab, setActiveTab] = createSignal<TabId>("discover")
  const [authScreen, setAuthScreen] = createSignal<AuthScreen>("login")
  const [showAuthPanel, setShowAuthPanel] = createSignal(false)
  const auth = useAuthStore()

  const renderContent = () => {
    const tab = activeTab()

    switch (tab) {
      case "feeds":
        return (
          <FeedList
            feeds={MOCK_FEEDS}
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
                <text>
                  <span fg="gray">Account:</span>
                </text>
                {auth.isAuthenticated ? (
                  <text>
                    <span fg="green">Signed in as {auth.user?.email}</span>
                  </text>
                ) : (
                  <text>
                    <span fg="yellow">Not signed in</span>
                  </text>
                )}
                <box
                  border
                  padding={0}
                  onMouseDown={() => setShowAuthPanel(true)}
                >
                  <text>
                    <span fg="cyan">
                      {auth.isAuthenticated ? "[A] Account" : "[A] Sign In"}
                    </span>
                  </text>
                </box>
              </box>
            </box>
          </box>
        )

      case "discover":
      case "search":
      case "player":
      default:
        return (
          <box border style={{ padding: 2 }}>
            <text>
              <strong>{tab}</strong>
              <br />
              <span fg="gray">Content placeholder - coming in later phases</span>
            </text>
          </box>
        )
    }
  }

  return (
    <KeyboardHandler onTabSelect={setActiveTab}>
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
    </KeyboardHandler>
  )
}
