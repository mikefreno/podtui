const createSignal = <T,>(value: T): [() => T, (next: T) => void] => {
  let current = value
  return [() => current, (next) => {
    current = next
  }]
}

import { FilePicker } from "./FilePicker"

export function ImportDialog() {
  const filePath = createSignal("")

  return (
    <box border title="Import" style={{ padding: 1, flexDirection: "column", gap: 1 }}>
      <FilePicker value={filePath[0]()} onChange={filePath[1]} />
      <box border>
        <text>Import selected file</text>
      </box>
    </box>
  )
}
