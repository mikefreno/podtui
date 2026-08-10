const createSignal = <T,>(value: T): [() => T, (next: T) => void] => {
	let current = value;
	return [
		() => current,
		(next) => {
			current = next;
		},
	];
};

import { SyncStatus } from "./SyncStatus";
import { useTheme } from "@/context/ThemeContext";
import { useInputFocusNav } from "@/hooks/useInputFocusNav";

export function ExportDialog() {
	const { theme } = useTheme();
	const filename = createSignal("podcast-sync.json");
	const format = createSignal<"json" | "xml">("json");
	// Yield navigation keybinds to the Shell router while the input is focused.
	const filenameRef = useInputFocusNav();

	return (
		<box
			border
			title="Export"
			style={{ padding: 1, flexDirection: "column", gap: 1 }}
		>
			<box style={{ flexDirection: "row", gap: 1 }}>
				<text fg={theme.text}>File:</text>
				<input
					ref={filenameRef}
					value={filename[0]()}
					onInput={filename[1]}
					style={{ width: 30 }}
					textColor={theme.text}
					focusedTextColor={theme.accent}
					cursorColor={theme.accent}
				/>
			</box>
			<box style={{ flexDirection: "row", gap: 1 }}>
				<text fg={theme.text}>Format:</text>
				<tab_select
					options={[
						{ name: "JSON", description: "Portable" },
						{ name: "XML", description: "Structured" },
					]}
					onSelect={(index) => format[1](index === 0 ? "json" : "xml")}
				/>
			</box>
			<box border borderColor={theme.border}>
				<text fg={theme.text}>
					Export {format[0]()} to {filename[0]()}
				</text>
			</box>
			<SyncStatus />
		</box>
	);
}
