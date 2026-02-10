import { shortcuts } from "@/config/shortcuts";
import { useTheme } from "@/context/ThemeContext";

export function ShortcutHelp() {
  const { theme } = useTheme();
  return (
    <box border title="Shortcuts" style={{ padding: 1 }}>
      <box style={{ flexDirection: "column" }}>
        <box style={{ flexDirection: "row" }}>
          <text fg={theme.text}>{shortcuts[0]?.keys ?? ""} </text>
          <text fg={theme.text}>{shortcuts[0]?.action ?? ""}</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text fg={theme.text}>{shortcuts[1]?.keys ?? ""} </text>
          <text fg={theme.text}>{shortcuts[1]?.action ?? ""}</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text fg={theme.text}>{shortcuts[2]?.keys ?? ""} </text>
          <text fg={theme.text}>{shortcuts[2]?.action ?? ""}</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text fg={theme.text}>{shortcuts[3]?.keys ?? ""} </text>
          <text fg={theme.text}>{shortcuts[3]?.action ?? ""}</text>
        </box>
      </box>
    </box>
  );
}
