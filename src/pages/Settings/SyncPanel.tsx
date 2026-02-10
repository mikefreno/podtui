const createSignal = <T,>(value: T): [() => T, (next: T) => void] => {
  let current = value
  return [() => current, (next) => {
    current = next
  }]
}

import { ImportDialog } from "./ImportDialog"
import { ExportDialog } from "./ExportDialog"
import { SyncStatus } from "./SyncStatus"
import { useTheme } from "@/context/ThemeContext"

export function SyncPanel() {
  const { theme } = useTheme();
  const mode = createSignal<"import" | "export" | null>(null)

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <box style={{ flexDirection: "row", gap: 1 }}>
        <box border borderColor={theme.border} onMouseDown={() => mode[1]("import")}>
          <text fg={theme.text}>Import</text>
        </box>
        <box border borderColor={theme.border} onMouseDown={() => mode[1]("export")}>
          <text fg={theme.text}>Export</text>
        </box>
      </box>
      <SyncStatus />
      {mode[0]() === "import" ? <ImportDialog /> : null}
      {mode[0]() === "export" ? <ExportDialog /> : null}
    </box>
  )
}
