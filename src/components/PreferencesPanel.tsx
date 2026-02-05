import { createSignal } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useAppStore } from "../stores/app"
import { createColorResolver } from "../utils/color"
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

  const resolveColor = createColorResolver(appStore.resolveTheme())

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
      <text fg={resolveColor("--color-muted")}>Preferences</text>

      <box flexDirection="column" gap={1}>
        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={focusField() === "theme" ? resolveColor("--color-primary") : resolveColor("--color-muted")}>Theme:</text>
          <box border padding={0}>
            <text fg={resolveColor("--color-text")}>{THEME_LABELS.find((t) => t.value === settings().theme)?.label}</text>
          </box>
          <text fg={resolveColor("--color-muted")}>[Left/Right]</text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={focusField() === "font" ? resolveColor("--color-primary") : resolveColor("--color-muted")}>Font Size:</text>
          <box border padding={0}>
            <text fg={resolveColor("--color-text")}>{settings().fontSize}px</text>
          </box>
          <text fg={resolveColor("--color-muted")}>[Left/Right]</text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={focusField() === "speed" ? resolveColor("--color-primary") : resolveColor("--color-muted")}>Playback:</text>
          <box border padding={0}>
            <text fg={resolveColor("--color-text")}>{settings().playbackSpeed}x</text>
          </box>
          <text fg={resolveColor("--color-muted")}>[Left/Right]</text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={focusField() === "explicit" ? resolveColor("--color-primary") : resolveColor("--color-muted")}>Show Explicit:</text>
          <box border padding={0}>
            <text fg={preferences().showExplicit ? resolveColor("--color-success") : resolveColor("--color-muted")}>
              {preferences().showExplicit ? "On" : "Off"}
            </text>
          </box>
          <text fg={resolveColor("--color-muted")}>[Space]</text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={focusField() === "auto" ? resolveColor("--color-primary") : resolveColor("--color-muted")}>Auto Download:</text>
          <box border padding={0}>
            <text fg={preferences().autoDownload ? resolveColor("--color-success") : resolveColor("--color-muted")}>
              {preferences().autoDownload ? "On" : "Off"}
            </text>
          </box>
          <text fg={resolveColor("--color-muted")}>[Space]</text>
        </box>
      </box>

      <text fg={resolveColor("--color-muted")}>Tab to move focus, Left/Right to adjust</text>
    </box>
  )
}
