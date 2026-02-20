import { useTheme } from "@/context/ThemeContext";
import { TABS, TabsCount } from "@/utils/navigation";
import { For } from "solid-js";
import { SelectableBox, SelectableText } from "@/components/Selectable";
import { useNavigation } from "@/context/NavigationContext";

export const tabs: TabDefinition[] = [
  { id: TABS.FEED, label: "Feed" },
  { id: TABS.MYSHOWS, label: "My Shows" },
  { id: TABS.DISCOVER, label: "Discover" },
  { id: TABS.SEARCH, label: "Search" },
  { id: TABS.PLAYER, label: "Player" },
  { id: TABS.SETTINGS, label: "Settings" },
];

export function TabNavigation() {
  const { theme } = useTheme();
  const { activeTab, setActiveTab, activeDepth } = useNavigation();
  return (
    <box
      border
      borderColor={activeDepth() !== 0 ? theme.border : theme.accent}
      backgroundColor={"transparent"}
      style={{
        flexDirection: "column",
        width: 12,
        height: TabsCount * 3 + 2,
      }}
    >
      <For each={tabs}>
        {(tab) => (
          <SelectableBox
            border
            height={3}
            selected={() => tab.id == activeTab()}
            onMouseDown={() => setActiveTab(tab.id)}
          >
            <SelectableText
              selected={() => tab.id == activeTab()}
              primary
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
