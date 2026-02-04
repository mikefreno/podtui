type FileInfoProps = {
  path: string
  format: string
  size: string
  modifiedAt: string
}

export function FileInfo(props: FileInfoProps) {
  return (
    <box border title="File Info" style={{ padding: 1, flexDirection: "column" }}>
      <text>Path: {props.path}</text>
      <text>Format: {props.format}</text>
      <text>Size: {props.size}</text>
      <text>Modified: {props.modifiedAt}</text>
    </box>
  )
}
