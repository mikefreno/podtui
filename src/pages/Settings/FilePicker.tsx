import { detectFormat } from "@/utils/file-detector";
import { useTheme } from "@/context/ThemeContext";
import { useInputFocusNav } from "@/hooks/useInputFocusNav";

type FilePickerProps = {
	value: string;
	onChange: (value: string) => void;
};

export function FilePicker(props: FilePickerProps) {
	const { theme } = useTheme();
	// Yield navigation keybinds to the Shell router while the input is focused.
	const inputRef = useInputFocusNav();
	const format = detectFormat(props.value);

	return (
		<box style={{ flexDirection: "column", gap: 1 }}>
			<input
				ref={inputRef}
				value={props.value}
				onInput={props.onChange}
				placeholder="/path/to/sync-file.json"
				style={{ width: 40 }}
			/>
			<text fg={theme.text}>Format: {format}</text>
		</box>
	);
}
