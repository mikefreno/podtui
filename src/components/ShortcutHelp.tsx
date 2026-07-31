import { For } from "solid-js";
import { shortcuts } from "@/config/shortcuts";
import { useTheme } from "@/context/ThemeContext";

/** Yazi-style keybind reference. The Shell has its own overlay; this component
 *  is kept for embedding inside Settings or other surfaces. */
export function ShortcutHelp() {
	const { theme } = useTheme();
	return (
		<box
			border
			title="Shortcuts"
			style={{ flexDirection: "column", padding: 1 }}
		>
			<box style={{ flexDirection: "column" }}>
				<For each={shortcuts}>
					{(s) => (
						<box style={{ flexDirection: "row" }} gap={2}>
							<text fg={theme.accent}>{s.keys}</text>
							<text fg={theme.text}>{s.action}</text>
						</box>
					)}
				</For>
			</box>
		</box>
	);
}
