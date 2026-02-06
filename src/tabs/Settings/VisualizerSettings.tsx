/**
 * VisualizerSettings — settings panel for the real-time audio visualizer.
 *
 * Allows adjusting bar count, noise reduction, sensitivity, and
 * frequency cutoffs. All changes persist via the app store.
 */

import { createSignal } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { useAppStore } from "@/stores/app";
import { useTheme } from "@/context/ThemeContext";

type FocusField = "bars" | "sensitivity" | "noise" | "lowCut" | "highCut";

const FIELDS: FocusField[] = [
  "bars",
  "sensitivity",
  "noise",
  "lowCut",
  "highCut",
];

export function VisualizerSettings() {
  const appStore = useAppStore();
  const { theme } = useTheme();
  const [focusField, setFocusField] = createSignal<FocusField>("bars");

  const viz = () => appStore.state().settings.visualizer;

  const handleKey = (key: { name: string; shift?: boolean }) => {
    if (key.name === "tab") {
      const idx = FIELDS.indexOf(focusField());
      const next = key.shift
        ? (idx - 1 + FIELDS.length) % FIELDS.length
        : (idx + 1) % FIELDS.length;
      setFocusField(FIELDS[next]);
      return;
    }

    if (key.name === "left" || key.name === "h") {
      stepValue(-1);
    }
    if (key.name === "right" || key.name === "l") {
      stepValue(1);
    }
  };

  const stepValue = (delta: number) => {
    const field = focusField();
    const v = viz();

    switch (field) {
      case "bars": {
        // Step by 8: 8, 16, 24, 32, ..., 128
        const next = Math.min(128, Math.max(8, v.bars + delta * 8));
        appStore.updateVisualizer({ bars: next });
        break;
      }
      case "sensitivity": {
        // Toggle: 0 (manual) or 1 (auto)
        appStore.updateVisualizer({ sensitivity: v.sensitivity === 1 ? 0 : 1 });
        break;
      }
      case "noise": {
        // Step by 0.05: 0.0 – 1.0
        const next = Math.min(
          1,
          Math.max(0, Number((v.noiseReduction + delta * 0.05).toFixed(2))),
        );
        appStore.updateVisualizer({ noiseReduction: next });
        break;
      }
      case "lowCut": {
        // Step by 10: 20 – 500 Hz
        const next = Math.min(500, Math.max(20, v.lowCutOff + delta * 10));
        appStore.updateVisualizer({ lowCutOff: next });
        break;
      }
      case "highCut": {
        // Step by 500: 1000 – 20000 Hz
        const next = Math.min(
          20000,
          Math.max(1000, v.highCutOff + delta * 500),
        );
        appStore.updateVisualizer({ highCutOff: next });
        break;
      }
    }
  };

  useKeyboard(handleKey);

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.textMuted}>Visualizer</text>

      <box flexDirection="column" gap={1}>
        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={focusField() === "bars" ? theme.primary : theme.textMuted}>
            Bars:
          </text>
          <box border padding={0}>
            <text fg={theme.text}>{viz().bars}</text>
          </box>
          <text fg={theme.textMuted}>[Left/Right +/-8]</text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text
            fg={
              focusField() === "sensitivity" ? theme.primary : theme.textMuted
            }
          >
            Auto Sensitivity:
          </text>
          <box border padding={0}>
            <text
              fg={viz().sensitivity === 1 ? theme.success : theme.textMuted}
            >
              {viz().sensitivity === 1 ? "On" : "Off"}
            </text>
          </box>
          <text fg={theme.textMuted}>[Left/Right]</text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={focusField() === "noise" ? theme.primary : theme.textMuted}>
            Noise Reduction:
          </text>
          <box border padding={0}>
            <text fg={theme.text}>{viz().noiseReduction.toFixed(2)}</text>
          </box>
          <text fg={theme.textMuted}>[Left/Right +/-0.05]</text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text
            fg={focusField() === "lowCut" ? theme.primary : theme.textMuted}
          >
            Low Cutoff:
          </text>
          <box border padding={0}>
            <text fg={theme.text}>{viz().lowCutOff} Hz</text>
          </box>
          <text fg={theme.textMuted}>[Left/Right +/-10]</text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text
            fg={focusField() === "highCut" ? theme.primary : theme.textMuted}
          >
            High Cutoff:
          </text>
          <box border padding={0}>
            <text fg={theme.text}>{viz().highCutOff} Hz</text>
          </box>
          <text fg={theme.textMuted}>[Left/Right +/-500]</text>
        </box>
      </box>

      <text fg={theme.textMuted}>Tab to move focus, Left/Right to adjust</text>
    </box>
  );
}
