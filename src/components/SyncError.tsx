type SyncErrorProps = {
  message: string
  onRetry: () => void
}

export function SyncError(props: SyncErrorProps) {
  return (
    <box border title="Error" style={{ padding: 1, flexDirection: "column", gap: 1 }}>
      <text>{props.message}</text>
      <box border onMouseDown={props.onRetry}>
        <text>Retry</text>
      </box>
    </box>
  )
}
