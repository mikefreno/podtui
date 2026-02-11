import { useTheme } from "@/context/ThemeContext";
import { TABS } from "@/utils/navigation";
import { For } from "solid-js";
import { SelectableBox, SelectableText } from "@/components/Selectable";

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
          <SelectableBox
            border
            selected={() => tab.id == props.activeTab}
            onMouseDown={() => props.onTabSelect(tab.id)}
          >
            <SelectableText
              selected={() => tab.id == props.activeTab}
              alignSelf="center"
            >
              {tab.label}
            </SelectableText>
          </SelectableBox>
        )}
      </For>
    </box>
  );
}

export type TabDefinition = {
  id: TABS;
  label: string;
};
