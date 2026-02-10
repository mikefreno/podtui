import { detectFormat } from "@/utils/file-detector";
import { useTheme } from "@/context/ThemeContext";

type FilePickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export function FilePicker(props: FilePickerProps) {
  const { theme } = useTheme();
  const format = detectFormat(props.value);

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <input
        value={props.value}
        onInput={props.onChange}
        placeholder="/path/to/sync-file.json"
        style={{ width: 40 }}
      />
      <text fg={theme.text}>Format: {format}</text>
    </box>
  );
}
