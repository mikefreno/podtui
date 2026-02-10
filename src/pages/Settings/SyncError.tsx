import { useTheme } from "@/context/ThemeContext"

type SyncErrorProps = {
  message: string
  onRetry: () => void
}

export function SyncError(props: SyncErrorProps) {
  const { theme } = useTheme();
  return (
    <box border title="Error" style={{ padding: 1, flexDirection: "column", gap: 1 }}>
      <text fg={theme.text}>{props.message}</text>
      <box border borderColor={theme.border} onMouseDown={props.onRetry}>
        <text fg={theme.text}>Retry</text>
      </box>
    </box>
  )
}
