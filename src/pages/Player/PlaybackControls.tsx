import type { BackendName } from "@/utils/audio-player";
import { useTheme } from "@/context/ThemeContext";

type PlaybackControlsProps = {
	isPlaying: boolean;
	volume: number;
	speed: number;
	backendName?: BackendName;
	hasAudioUrl?: boolean;
	onToggle: () => void;
	onPrev: () => void;
	onNext: () => void;
	onVolumeChange: (value: number) => void;
	onSpeedChange: (value: number) => void;
};

const BACKEND_LABELS: Record<BackendName, string> = {
	mpv: "mpv",
	ffplay: "ffplay",
	afplay: "afplay",
	system: "system",
	none: "none",
};

export function PlaybackControls(props: PlaybackControlsProps) {
	const { theme } = useTheme();
	return (
		<box
			flexDirection="row"
			gap={1}
			alignItems="center"
			border
			padding={1}
			borderColor={theme.border}
		>
			<box
				border
				padding={0}
				onMouseDown={props.onPrev}
				borderColor={theme.border}
			>
				<text fg={theme.primary}>[Prev]</text>
			</box>
			<box
				border
				padding={0}
				onMouseDown={props.onToggle}
				borderColor={theme.border}
			>
				<text fg={theme.primary}>{props.isPlaying ? "[Pause]" : "[Play]"}</text>
			</box>
			<box
				border
				padding={0}
				onMouseDown={props.onNext}
				borderColor={theme.border}
			>
				<text fg={theme.primary}>[Next]</text>
			</box>
			<box flexDirection="row" gap={1} marginLeft={2}>
				<text fg={theme.textMuted}>Vol</text>
				<text fg={theme.text}>{Math.round(props.volume * 100)}%</text>
			</box>
			<box flexDirection="row" gap={1} marginLeft={2}>
				<text fg={theme.textMuted}>Speed</text>
				<text fg={theme.text}>{props.speed}x</text>
			</box>
			{props.backendName && props.backendName !== "none" && (
				<box flexDirection="row" gap={1} marginLeft={2}>
					<text fg={theme.textMuted}>via</text>
					<text fg={theme.primary}>{BACKEND_LABELS[props.backendName]}</text>
				</box>
			)}
			{props.backendName === "none" && (
				<box marginLeft={2}>
					<text fg={theme.warning}>No audio player found</text>
				</box>
			)}
			{props.hasAudioUrl === false && (
				<box marginLeft={2}>
					<text fg={theme.warning}>No audio URL</text>
				</box>
			)}
		</box>
	);
}
