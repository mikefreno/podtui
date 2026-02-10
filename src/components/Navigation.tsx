import type { TabId } from "./Tab"
import { useTheme } from "@/context/ThemeContext"

type NavigationProps = {
  activeTab: TabId
  onTabSelect: (tab: TabId) => void
}

export function Navigation(props: NavigationProps) {
  const { theme } = useTheme();
  return (
    <box style={{ flexDirection: "row", width: "100%", height: 1 }}>
      <text fg={theme.text}>
        {props.activeTab === "feed" ? "[" : " "}Feed{props.activeTab === "feed" ? "]" : " "}
        <span> </span>
        {props.activeTab === "shows" ? "[" : " "}My Shows{props.activeTab === "shows" ? "]" : " "}
        <span> </span>
        {props.activeTab === "discover" ? "[" : " "}Discover{props.activeTab === "discover" ? "]" : " "}
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
