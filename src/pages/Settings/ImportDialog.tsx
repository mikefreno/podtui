const createSignal = <T,>(value: T): [() => T, (next: T) => void] => {
  let current = value
  return [() => current, (next) => {
    current = next
  }]
}

import { FilePicker } from "./FilePicker"
import { useTheme } from "@/context/ThemeContext"

export function ImportDialog() {
  const { theme } = useTheme();
  const filePath = createSignal("")

  return (
    <box border title="Import" style={{ padding: 1, flexDirection: "column", gap: 1 }}>
      <FilePicker value={filePath[0]()} onChange={filePath[1]} />
      <box border borderColor={theme.border}>
        <text fg={theme.text}>Import selected file</text>
      </box>
    </box>
  )
}
