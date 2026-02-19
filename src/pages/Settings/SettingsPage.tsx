import { createSignal, For } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { SourceManager } from "./SourceManager";
import { useTheme } from "@/context/ThemeContext";
import { PreferencesPanel } from "./PreferencesPanel";
import { SyncPanel } from "./SyncPanel";
import { VisualizerSettings } from "./VisualizerSettings";
import { useNavigation } from "@/context/NavigationContext";

enum SettingsPaneType {
  SYNC = 1,
  SOURCES = 2,
  PREFERENCES = 3,
  VISUALIZER = 4,
  ACCOUNT = 5,
}
export const SettingsPaneCount = 5;

const SECTIONS: Array<{ id: SettingsPaneType; label: string }> = [
  { id: SettingsPaneType.SYNC, label: "Sync" },
  { id: SettingsPaneType.SOURCES, label: "Sources" },
  { id: SettingsPaneType.PREFERENCES, label: "Preferences" },
  { id: SettingsPaneType.VISUALIZER, label: "Visualizer" },
  { id: SettingsPaneType.ACCOUNT, label: "Account" },
];

export function SettingsPage() {
  const { theme } = useTheme();
  const nav = useNavigation();

  return (
    <box flexDirection="column" gap={1} height="100%" width="100%">
      <box flexDirection="row" gap={1}>
        <For each={SECTIONS}>
          {(section, index) => (
            <box
              border
              borderColor={theme.border}
              padding={0}
              backgroundColor={
                nav.activeDepth === section.id ? theme.primary : undefined
              }
              onMouseDown={() => nav.setActiveDepth(section.id)}
            >
              <text
                fg={
                  nav.activeDepth === section.id ? theme.text : theme.textMuted
                }
              >
                [{index() + 1}] {section.label}
              </text>
            </box>
          )}
        </For>
      </box>

      <box
        border
        borderColor={theme.border}
        flexGrow={1}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        {nav.activeDepth === SettingsPaneType.SYNC && <SyncPanel />}
        {nav.activeDepth === SettingsPaneType.SOURCES && (
          <SourceManager focused />
        )}
        {nav.activeDepth === SettingsPaneType.PREFERENCES && (
          <PreferencesPanel />
        )}
        {nav.activeDepth === SettingsPaneType.VISUALIZER && (
          <VisualizerSettings />
        )}
        {nav.activeDepth === SettingsPaneType.ACCOUNT && (
          <box flexDirection="column" gap={1}>
            <text fg={theme.textMuted}>Account</text>
          </box>
        )}
      </box>
    </box>
  );
}
