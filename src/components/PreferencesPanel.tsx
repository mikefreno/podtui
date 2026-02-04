import { createSignal } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useAppStore } from "../stores/app"
import type { ThemeName } from "../types/settings"

type FocusField = "theme" | "font" | "speed" | "explicit" | "auto"

const THEME_LABELS: Array<{ value: ThemeName; label: string }> = [
  { value: "system", label: "System" },
  { value: "catppuccin", label: "Catppuccin" },
  { value: "gruvbox", label: "Gruvbox" },
  { value: "tokyo", label: "Tokyo" },
  { value: "nord", label: "Nord" },
  { value: "custom", label: "Custom" },
]

export function PreferencesPanel() {
  const appStore = useAppStore()
  const [focusField, setFocusField] = createSignal<FocusField>("theme")

  const settings = () => appStore.state().settings
  const preferences = () => appStore.state().preferences

  const handleKey = (key: { name: string; shift?: boolean }) => {
    if (key.name === "tab") {
      const fields: FocusField[] = ["theme", "font", "speed", "explicit", "auto"]
      const idx = fields.indexOf(focusField())
      const next = key.shift
        ? (idx - 1 + fields.length) % fields.length
        : (idx + 1) % fields.length
      setFocusField(fields[next])
      return
    }

    if (key.name === "left" || key.name === "h") {
      stepValue(-1)
    }
    if (key.name === "right" || key.name === "l") {
      stepValue(1)
    }
    if (key.name === "space" || key.name === "enter") {
      toggleValue()
    }
  }

  const stepValue = (delta: number) => {
    const field = focusField()
    if (field === "theme") {
      const idx = THEME_LABELS.findIndex((t) => t.value === settings().theme)
      const next = (idx + delta + THEME_LABELS.length) % THEME_LABELS.length
      appStore.setTheme(THEME_LABELS[next].value)
      return
    }
    if (field === "font") {
      const next = Math.min(20, Math.max(10, settings().fontSize + delta))
      appStore.updateSettings({ fontSize: next })
      return
    }
    if (field === "speed") {
      const next = Math.min(2, Math.max(0.5, settings().playbackSpeed + delta * 0.1))
      appStore.updateSettings({ playbackSpeed: Number(next.toFixed(1)) })
    }
  }

  const toggleValue = () => {
    const field = focusField()
    if (field === "explicit") {
      appStore.updatePreferences({ showExplicit: !preferences().showExplicit })
    }
    if (field === "auto") {
      appStore.updatePreferences({ autoDownload: !preferences().autoDownload })
    }
  }

  useKeyboard(handleKey)

  return (
    <box flexDirection="column" gap={1}>
      <text fg="gray">Preferences</text>

      <box flexDirection="column" gap={1}>
        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={focusField() === "theme" ? "cyan" : "gray"}>Theme:</text>
          <box border padding={0}>
            <text fg="white">{THEME_LABELS.find((t) => t.value === settings().theme)?.label}</text>
          </box>
          <text fg="gray">[Left/Right]</text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={focusField() === "font" ? "cyan" : "gray"}>Font Size:</text>
          <box border padding={0}>
            <text fg="white">{settings().fontSize}px</text>
          </box>
          <text fg="gray">[Left/Right]</text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={focusField() === "speed" ? "cyan" : "gray"}>Playback:</text>
          <box border padding={0}>
            <text fg="white">{settings().playbackSpeed}x</text>
          </box>
          <text fg="gray">[Left/Right]</text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={focusField() === "explicit" ? "cyan" : "gray"}>Show Explicit:</text>
          <box border padding={0}>
            <text fg={preferences().showExplicit ? "green" : "gray"}>
              {preferences().showExplicit ? "On" : "Off"}
            </text>
          </box>
          <text fg="gray">[Space]</text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={focusField() === "auto" ? "cyan" : "gray"}>Auto Download:</text>
          <box border padding={0}>
            <text fg={preferences().autoDownload ? "green" : "gray"}>
              {preferences().autoDownload ? "On" : "Off"}
            </text>
          </box>
          <text fg="gray">[Space]</text>
        </box>
      </box>

      <text fg="gray">Tab to move focus, Left/Right to adjust</text>
    </box>
  )
}
