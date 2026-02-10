const createSignal = <T,>(value: T): [() => T, (next: T) => void] => {
  let current = value
  return [() => current, (next) => {
    current = next
  }]
}

import { SyncProgress } from "./SyncProgress"
import { SyncError } from "./SyncError"
import { useTheme } from "@/context/ThemeContext"

type SyncState = "idle" | "syncing" | "complete" | "error"

export function SyncStatus() {
  const { theme } = useTheme();
  const state = createSignal<SyncState>("idle")
  const message = createSignal("Idle")
  const progress = createSignal(0)

  const toggle = () => {
    if (state[0]() === "idle") {
      state[1]("syncing")
      message[1]("Syncing...")
      progress[1](40)
    } else if (state[0]() === "syncing") {
      state[1]("complete")
      message[1]("Sync complete")
      progress[1](100)
    } else if (state[0]() === "complete") {
      state[1]("error")
      message[1]("Sync failed")
    } else {
      state[1]("idle")
      message[1]("Idle")
      progress[1](0)
    }
  }

  return (
    <box border title="Sync Status" borderColor={theme.border} style={{ padding: 1, flexDirection: "column", gap: 1 }}>
      <box style={{ flexDirection: "row", gap: 1 }}>
        <text fg={theme.text}>Status:</text>
        <text fg={theme.text}>{message[0]()}</text>
      </box>
      <SyncProgress value={progress[0]()} />
      {state[0]() === "error" ? <SyncError message={message[0]()} onRetry={() => toggle()} /> : null}
      <box border borderColor={theme.border} onMouseDown={toggle}>
        <text fg={theme.text}>Cycle Status</text>
      </box>
    </box>
  )
}
