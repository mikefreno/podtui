import { createSignal, createMemo, Show, onCleanup } from "solid-js";
import { useTheme } from "@/context/ThemeContext";

const spinnerChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Animated braille spinner with an optional label (e.g. "Refreshing…").
 * The spinner is rendered in the theme primary color; the label in muted.
 */
export function LoadingIndicator(props: { label?: string }) {
	const { theme } = useTheme();
	const [index, setIndex] = createSignal(0);

	const interval = setInterval(() => {
		setIndex((i) => (i + 1) % spinnerChars.length);
	}, 65);

	onCleanup(() => clearInterval(interval));

	const currentChar = createMemo(() => spinnerChars[index()]);

	return (
		<box flexDirection="row" gap={1} alignItems="flex-start">
			<text fg={theme.primary} content={currentChar()} />
			<Show when={props.label}>
				<text fg={theme.muted || theme.text} content={props.label} />
			</Show>
		</box>
	);
}
