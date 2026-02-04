import { shortcuts } from "../config/shortcuts"

export function ShortcutHelp() {
  return (
    <box border title="Shortcuts" style={{ padding: 1 }}>
      <box style={{ flexDirection: "column" }}>
        <box style={{ flexDirection: "row" }}>
          <text>{shortcuts[0]?.keys ?? ""} </text>
          <text>{shortcuts[0]?.action ?? ""}</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text>{shortcuts[1]?.keys ?? ""} </text>
          <text>{shortcuts[1]?.action ?? ""}</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text>{shortcuts[2]?.keys ?? ""} </text>
          <text>{shortcuts[2]?.action ?? ""}</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text>{shortcuts[3]?.keys ?? ""} </text>
          <text>{shortcuts[3]?.action ?? ""}</text>
        </box>
      </box>
    </box>
  )
}
