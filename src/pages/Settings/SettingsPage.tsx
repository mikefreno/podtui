import { createSignal, For } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { SourceManager } from "./SourceManager";
import { useTheme } from "@/context/ThemeContext";
import { PreferencesPanel } from "./PreferencesPanel";
import { SyncPanel } from "./SyncPanel";
import { VisualizerSettings } from "./VisualizerSettings";
import { PageProps } from "@/App";

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

export function SettingsPage(props: PageProps) {
  const { theme } = useTheme();
  const [activeSection, setActiveSection] = createSignal<SettingsPaneType>(
    SettingsPaneType.SYNC,
  );

  return (
    <box flexDirection="column" gap={1} height="100%" width="100%">
      <box flexDirection="row" gap={1}>
        <For each={SECTIONS}>
          {(section, index) => (
            <box
              border
              padding={0}
              backgroundColor={
                activeSection() === section.id ? theme.primary : undefined
              }
              onMouseDown={() => setActiveSection(section.id)}
            >
              <text
                fg={
                  activeSection() === section.id ? theme.text : theme.textMuted
                }
              >
                [{index() + 1}] {section.label}
              </text>
            </box>
          )}
        </For>
      </box>

      <box border flexGrow={1} padding={1} flexDirection="column" gap={1}>
        {activeSection() === SettingsPaneType.SYNC && <SyncPanel />}
        {activeSection() === SettingsPaneType.SOURCES && (
          <SourceManager focused />
        )}
        {activeSection() === SettingsPaneType.PREFERENCES && (
          <PreferencesPanel />
        )}
        {activeSection() === SettingsPaneType.VISUALIZER && (
          <VisualizerSettings />
        )}
        {activeSection() === SettingsPaneType.ACCOUNT && (
          <box flexDirection="column" gap={1}>
            <text fg={theme.textMuted}>Account</text>
          </box>
        )}
      </box>
    </box>
  );
}
