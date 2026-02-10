import { useTheme } from "@/context/ThemeContext"

type SyncProgressProps = {
  value: number
}

export function SyncProgress(props: SyncProgressProps) {
  const { theme } = useTheme();
  const width = 30
  let filled = (props.value / 100) * width
  filled = filled >= 0 ? filled : 0
  filled = filled <= width ? filled : width
  filled = filled | 0
  if (filled < 0) filled = 0
  if (filled > width) filled = width

  let bar = ""
  for (let i = 0; i < width; i += 1) {
    bar += i < filled ? "#" : "-"
  }

  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={theme.text}>{bar}</text>
      <text fg={theme.text}>{props.value}%</text>
    </box>
  )
}
