import { Tab, type TabId } from "./Tab"

type TabNavigationProps = {
  activeTab: TabId
  onTabSelect: (tab: TabId) => void
}

export function TabNavigation(props: TabNavigationProps) {
  return (
    <box style={{ flexDirection: "row", gap: 1 }}>
      <Tab tab={{ id: "feed", label: "Feed" }} active={props.activeTab === "feed"} onSelect={props.onTabSelect} />
      <Tab tab={{ id: "shows", label: "My Shows" }} active={props.activeTab === "shows"} onSelect={props.onTabSelect} />
      <Tab tab={{ id: "discover", label: "Discover" }} active={props.activeTab === "discover"} onSelect={props.onTabSelect} />
      <Tab tab={{ id: "search", label: "Search" }} active={props.activeTab === "search"} onSelect={props.onTabSelect} />
      <Tab tab={{ id: "player", label: "Player" }} active={props.activeTab === "player"} onSelect={props.onTabSelect} />
      <Tab tab={{ id: "settings", label: "Settings" }} active={props.activeTab === "settings"} onSelect={props.onTabSelect} />
    </box>
  )
}
