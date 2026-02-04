import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts"
import { Tab, type TabId } from "./Tab"

type TabNavigationProps = {
  activeTab: TabId
  onTabSelect: (tab: TabId) => void
}

export function TabNavigation(props: TabNavigationProps) {
  useKeyboardShortcuts({
    onTabNext: () => {
      if (props.activeTab === "discover") props.onTabSelect("feeds")
      else if (props.activeTab === "feeds") props.onTabSelect("search")
      else if (props.activeTab === "search") props.onTabSelect("player")
      else if (props.activeTab === "player") props.onTabSelect("settings")
      else props.onTabSelect("discover")
    },
    onTabPrev: () => {
      if (props.activeTab === "discover") props.onTabSelect("settings")
      else if (props.activeTab === "settings") props.onTabSelect("player")
      else if (props.activeTab === "player") props.onTabSelect("search")
      else if (props.activeTab === "search") props.onTabSelect("feeds")
      else props.onTabSelect("discover")
    },
  })

  return (
    <box style={{ flexDirection: "row", gap: 1 }}>
      <Tab tab={{ id: "discover", label: "Discover" }} active={props.activeTab === "discover"} onSelect={props.onTabSelect} />
      <Tab tab={{ id: "feeds", label: "My Feeds" }} active={props.activeTab === "feeds"} onSelect={props.onTabSelect} />
      <Tab tab={{ id: "search", label: "Search" }} active={props.activeTab === "search"} onSelect={props.onTabSelect} />
      <Tab tab={{ id: "player", label: "Player" }} active={props.activeTab === "player"} onSelect={props.onTabSelect} />
      <Tab tab={{ id: "settings", label: "Settings" }} active={props.activeTab === "settings"} onSelect={props.onTabSelect} />
    </box>
  )
}
