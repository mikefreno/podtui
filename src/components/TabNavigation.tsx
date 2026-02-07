import { useTheme } from "@/context/ThemeContext";
import { For } from "solid-js";

interface TabNavigationProps {
  activeTab: TabId;
  onTabSelect: (tab: TabId) => void;
}

export const tabs: TabDefinition[] = [
  { id: "feed", label: "Feed" },
  { id: "shows", label: "My Shows" },
  { id: "discover", label: "Discover" },
  { id: "search", label: "Search" },
  { id: "player", label: "Player" },
  { id: "settings", label: "Settings" },
];

export function TabNavigation(props: TabNavigationProps) {
  const { theme } = useTheme();
  return (
    <box style={{ flexDirection: "column", gap: 1, width: 20 }}>
      <For each={tabs}>
        {(tab) => (
          <box
            border
            borderColor={theme.border}
            onMouseDown={() => props.onTabSelect(tab.id)}
            style={{
              padding: 1,
              paddingLeft: 2,
              backgroundColor:
                tab.id == props.activeTab ? theme.primary : "transparent",
            }}
          >
            <text style={{ fg: theme.text }}>
              {tab.id == props.activeTab ? "[" : " "}
              {tab.label}
              {tab.id == props.activeTab ? "]" : " "}
            </text>
          </box>
        )}
      </For>
    </box>
  );
}

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
