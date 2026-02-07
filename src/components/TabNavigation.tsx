import { useTheme } from "@/context/ThemeContext";
import { TABS } from "@/utils/navigation";
import { For } from "solid-js";

interface TabNavigationProps {
  activeTab: TABS;
  onTabSelect: (tab: TABS) => void;
}

export const tabs: TabDefinition[] = [
  { id: TABS.FEED, label: "Feed" },
  { id: TABS.MYSHOWS, label: "My Shows" },
  { id: TABS.DISCOVER, label: "Discover" },
  { id: TABS.SEARCH, label: "Search" },
  { id: TABS.PLAYER, label: "Player" },
  { id: TABS.SETTINGS, label: "Settings" },
];

export function TabNavigation(props: TabNavigationProps) {
  const { theme } = useTheme();
  return (
    <box
      backgroundColor={theme.surface}
      style={{
        flexDirection: "column",
        width: 10,
        flexGrow: 1,
      }}
    >
      <For each={tabs}>
        {(tab) => (
          <box
            border
            borderColor={theme.border}
            onMouseDown={() => props.onTabSelect(tab.id)}
            style={{
              backgroundColor:
                tab.id == props.activeTab ? theme.primary : "transparent",
            }}
          >
            <text
              style={{
                fg: tab.id == props.activeTab ? "white" : theme.text,
                alignSelf: "center",
              }}
            >
              {tab.label}
            </text>
          </box>
        )}
      </For>
    </box>
  );
}

export type TabDefinition = {
  id: TABS;
  label: string;
};
