import { createSignal, For, onMount } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { SourceManager } from "./SourceManager";
import { useTheme } from "@/context/ThemeContext";
import { PreferencesPanel } from "./PreferencesPanel";
import { SyncPanel } from "./SyncPanel";
import { VisualizerSettings } from "./VisualizerSettings";
import { useNavigation } from "@/context/NavigationContext";
import { KeybindProvider, useKeybinds } from "@/context/KeybindContext";

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
  const keybind = useKeybinds();

  // Helper function to check if a depth is active
  const isActive = (depth: SettingsPaneType): boolean => {
    return nav.activeDepth() === depth;
  };

  // Helper function to get the current depth as a number
  const currentDepth = () => nav.activeDepth() as number;

  onMount(() => {
    useKeyboard(
      (keyEvent: any) => {
        const isDown = keybind.match("down", keyEvent);
        const isUp = keybind.match("up", keyEvent);
        const isCycle = keybind.match("cycle", keyEvent);
        const isSelect = keybind.match("select", keyEvent);

        if (isSelect) {
          nav.setActiveDepth((nav.activeDepth() % SettingsPaneCount) + 1);
          return;
        }

        const nextDepth = isDown
          ? (nav.activeDepth() % SettingsPaneCount) + 1
          : (nav.activeDepth() - 2 + SettingsPaneCount) % SettingsPaneCount + 1;

        if (isCycle) {
          nav.setActiveDepth((nav.activeDepth() % SettingsPaneCount) + 1);
        } else {
          nav.setActiveDepth(nextDepth);
        }
      },
      { release: false },
    );
  });

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
                currentDepth() === section.id ? theme.primary : undefined
              }
              onMouseDown={() => nav.setActiveDepth(section.id)}
            >
              <text
                fg={
                  currentDepth() === section.id ? theme.text : theme.textMuted
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
        borderColor={isActive(SettingsPaneType.SYNC) || isActive(SettingsPaneType.SOURCES) || isActive(SettingsPaneType.PREFERENCES) || isActive(SettingsPaneType.VISUALIZER) || isActive(SettingsPaneType.ACCOUNT) ? theme.accent : theme.border}
        flexGrow={1}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        {isActive(SettingsPaneType.SYNC) && <SyncPanel />}
        {isActive(SettingsPaneType.SOURCES) && (
          <SourceManager focused />
        )}
        {isActive(SettingsPaneType.PREFERENCES) && (
          <PreferencesPanel />
        )}
        {isActive(SettingsPaneType.VISUALIZER) && (
          <VisualizerSettings />
        )}
        {isActive(SettingsPaneType.ACCOUNT) && (
          <box flexDirection="column" gap={1}>
            <text fg={theme.textMuted}>Account</text>
          </box>
        )}
      </box>
    </box>
  );
}
