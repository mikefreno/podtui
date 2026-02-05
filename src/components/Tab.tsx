import { useTheme } from "../context/ThemeContext"

export type TabId = "discover" | "feeds" | "search" | "player" | "settings"

export type TabDefinition = {
  id: TabId
  label: string
}

export const tabs: TabDefinition[] = [
  { id: "discover", label: "Discover" },
  { id: "feeds", label: "My Feeds" },
  { id: "search", label: "Search" },
  { id: "player", label: "Player" },
  { id: "settings", label: "Settings" },
]

type TabProps = {
  tab: TabDefinition
  active: boolean
  onSelect: (tab: TabId) => void
}

export function Tab(props: TabProps) {
  const { theme } = useTheme()
  return (
    <box
      border
      onMouseDown={() => props.onSelect(props.tab.id)}
      style={{ padding: 1, backgroundColor: props.active ? theme.primary : "transparent" }}
    >
      <text>
        {props.active ? "[" : " "}
        {props.tab.label}
        {props.active ? "]" : " "}
      </text>
    </box>
  )
}
