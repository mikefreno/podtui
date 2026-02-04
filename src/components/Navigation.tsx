import type { TabId } from "./Tab"

type NavigationProps = {
  activeTab: TabId
  onTabSelect: (tab: TabId) => void
}

export function Navigation(props: NavigationProps) {
  return (
    <box style={{ flexDirection: "row", width: "100%", height: 1 }}>
      <text>
        {props.activeTab === "discover" ? "[" : " "}Discover{props.activeTab === "discover" ? "]" : " "}
        <span> </span>
        {props.activeTab === "feeds" ? "[" : " "}My Feeds{props.activeTab === "feeds" ? "]" : " "}
        <span> </span>
        {props.activeTab === "search" ? "[" : " "}Search{props.activeTab === "search" ? "]" : " "}
        <span> </span>
        {props.activeTab === "player" ? "[" : " "}Player{props.activeTab === "player" ? "]" : " "}
        <span> </span>
        {props.activeTab === "settings" ? "[" : " "}Settings{props.activeTab === "settings" ? "]" : " "}
      </text>
    </box>
  )
}
