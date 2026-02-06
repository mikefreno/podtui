import { useTheme } from "../context/ThemeContext";

export type TabId =
  | "feed"
  | "shows"
  | "discover"
  | "search"
  | "player"
  | "settings";

export type TabDefinition = {
  id: TabId;
  label: string;
};

export const tabs: TabDefinition[] = [
  { id: "feed", label: "Feed" },
  { id: "shows", label: "My Shows" },
  { id: "discover", label: "Discover" },
  { id: "search", label: "Search" },
  { id: "player", label: "Player" },
  { id: "settings", label: "Settings" },
];

type TabProps = {
  tab: TabDefinition;
  active: boolean;
  onSelect: (tab: TabId) => void;
};

export function Tab(props: TabProps) {
  const { theme } = useTheme();
  return (
    <box
      border
      borderColor={theme.border}
      onMouseDown={() => props.onSelect(props.tab.id)}
      style={{
        padding: 1,
        backgroundColor: props.active ? theme.primary : "transparent",
      }}
    >
      <text style={{ fg: theme.text }}>
        {props.active ? "[" : " "}
        {props.tab.label}
        {props.active ? "]" : " "}
      </text>
    </box>
  );
}
