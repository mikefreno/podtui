import { ErrorBoundary } from "solid-js";
import { useSelectionHandler, useRenderer } from "@opentui/solid";
import { useAuthStore } from "@/stores/auth";
import { useAudio } from "@/hooks/useAudio";
import { useMultimediaKeys } from "@/hooks/useMultimediaKeys";
import { Clipboard } from "@/utils/clipboard";
import { useToast } from "@/ui/toast";
import { useTheme, ThemeProvider } from "./context/ThemeContext";
import { KeybindProvider, useKeybinds } from "./context/KeybindContext";
import {
	NavigationProvider,
	useNavigation,
	NavMode,
} from "./context/NavigationContext";
import { TABS } from "./utils/navigation";
import { Shell } from "./components/Shell";

const DEBUG = import.meta.env.DEBUG;

export function App() {
	const nav = useNavigation();
	const auth = useAuthStore();
	const audio = useAudio();
	const toast = useToast();
	const renderer = useRenderer();
	const themeContext = useTheme();
	const theme = themeContext.theme;
	const keybind = useKeybinds();

	// Multimedia keys (physical play/seek keys) still feed the audio backend
	// regardless of the on-screen yazi keybinds.
	useMultimediaKeys({
		playerFocused: () =>
			nav.activeTab() === TABS.PLAYER && nav.mode() !== NavMode.NORMAL
				? true
				: false,
		inputFocused: () => nav.inputFocused(),
		hasEpisode: () => !!audio.currentEpisode(),
	});

	// Mouse text-selection → clipboard (unchanged from the old shell).
	useSelectionHandler((selection: any) => {
		if (!selection) return;
		const text = selection.getSelectedText?.();
		if (!text || text.trim().length === 0) return;
		Clipboard.copy(text)
			.then(() =>
				toast.show({ message: "Copied to Clipboard!", variant: "info" }),
			)
			.catch(toast.error)
			.finally(() => renderer.clearSelection());
	});

	const backgroundColor = () =>
		themeContext.selected === "system"
			? "transparent"
			: themeContext.theme.surface;

	return (
		<ErrorBoundary
			fallback={(err) => (
				<box border padding={2} borderColor={theme.error}>
					<text fg={theme.error}>
						Error: {err?.message ?? String(err)}
						{"\n"}
						Press 1-6 to switch tabs, or : to open the command bar.
					</text>
				</box>
			)}
		>
			<box
				flexDirection="column"
				width="100%"
				height="100%"
				backgroundColor={backgroundColor()}
			>
				{DEBUG && (
					<box flexDirection="row" width="100%" height={1}>
						<text fg={theme.primary}>█</text>
						<text fg={theme.secondary}>█</text>
						<text fg={theme.accent}>█</text>
						<text fg={theme.error}>█</text>
						<text fg={theme.warning}>█</text>
						<text fg={theme.success}>█</text>
						<text fg={theme.info}>█</text>
						<text fg={theme.text}>█</text>
						<text fg={theme.textMuted}>█</text>
						<text fg={theme.surface}>█</text>
					</box>
				)}
				<Shell />
			</box>
		</ErrorBoundary>
	);
}
