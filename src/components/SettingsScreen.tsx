import { createSignal } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { SourceManager } from "./SourceManager"
import { PreferencesPanel } from "./PreferencesPanel"
import { SyncPanel } from "./SyncPanel"

type SettingsScreenProps = {
  accountLabel: string
  accountStatus: "signed-in" | "signed-out"
  onOpenAccount?: () => void
  onExit?: () => void
}

type SectionId = "sync" | "sources" | "preferences" | "account"

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: "sync", label: "Sync" },
  { id: "sources", label: "Sources" },
  { id: "preferences", label: "Preferences" },
  { id: "account", label: "Account" },
]

export function SettingsScreen(props: SettingsScreenProps) {
  const [activeSection, setActiveSection] = createSignal<SectionId>("sync")

  useKeyboard((key) => {
    if (key.name === "escape") {
      props.onExit?.()
      return
    }

    if (key.name === "tab") {
      const idx = SECTIONS.findIndex((s) => s.id === activeSection())
      const next = key.shift
        ? (idx - 1 + SECTIONS.length) % SECTIONS.length
        : (idx + 1) % SECTIONS.length
      setActiveSection(SECTIONS[next].id)
      return
    }

    if (key.name === "1") setActiveSection("sync")
    if (key.name === "2") setActiveSection("sources")
    if (key.name === "3") setActiveSection("preferences")
    if (key.name === "4") setActiveSection("account")
  })

  return (
    <box flexDirection="column" gap={1} height="100%">
      <box flexDirection="row" justifyContent="space-between" alignItems="center">
        <text>
          <strong>Settings</strong>
        </text>
        <text fg="var(--color-muted)">[Tab] Switch section | 1-4 jump | Esc up</text>
      </box>

      <box flexDirection="row" gap={1}>
        {SECTIONS.map((section, index) => (
          <box
            border
            padding={0}
            backgroundColor={activeSection() === section.id ? "var(--color-primary)" : undefined}
            onMouseDown={() => setActiveSection(section.id)}
          >
            <text fg={activeSection() === section.id ? "var(--color-text)" : "var(--color-muted)"}>
              [{index + 1}] {section.label}
            </text>
          </box>
        ))}
      </box>

      <box border flexGrow={1} padding={1} flexDirection="column" gap={1}>
        {activeSection() === "sync" && <SyncPanel />}
        {activeSection() === "sources" && <SourceManager focused />}
        {activeSection() === "preferences" && <PreferencesPanel />}
        {activeSection() === "account" && (
          <box flexDirection="column" gap={1}>
            <text fg="var(--color-muted)">Account</text>
            <box flexDirection="row" gap={2} alignItems="center">
              <text fg="var(--color-muted)">Status:</text>
              <text fg={props.accountStatus === "signed-in" ? "var(--color-success)" : "var(--color-warning)"}>
                {props.accountLabel}
              </text>
            </box>
            <box border padding={0} onMouseDown={() => props.onOpenAccount?.()}>
              <text fg="var(--color-primary)">[A] Manage Account</text>
            </box>
          </box>
        )}
      </box>

      <text fg="var(--color-muted)">Enter to dive | Esc up</text>
    </box>
  )
}
