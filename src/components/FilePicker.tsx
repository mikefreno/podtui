import { detectFormat } from "../utils/file-detector"

type FilePickerProps = {
  value: string
  onChange: (value: string) => void
}

export function FilePicker(props: FilePickerProps) {
  const format = detectFormat(props.value)

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <input
        value={props.value}
        onInput={props.onChange}
        placeholder="/path/to/sync-file.json"
        style={{ width: 40 }}
      />
      <text>Format: {format}</text>
    </box>
  )
}
