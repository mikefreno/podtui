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

export function PlaybackControls(props: PlaybackControlsProps) {
	const { theme } = useTheme();
	return (
		<box
			flexDirection="row"
			flexWrap="wrap"
			gap={1}
			alignItems="center"
			justifyContent="center"
			border
			padding={1}
			borderColor={theme.border}
		>
			{/* transport buttons — wrap as a unit, centered on their own line */}
			<box flexDirection="row" gap={1} alignItems="center" flexShrink={0}>
				<box
					border
					padding={0}
					onMouseDown={props.onPrev}
					borderColor={theme.border}
				>
					<text fg={theme.primary} wrapMode="none">[Prev]</text>
				</box>
				<box
					border
					padding={0}
					onMouseDown={props.onToggle}
					borderColor={theme.border}
				>
					<text fg={theme.primary} wrapMode="none">{props.isPlaying ? "[Pause]" : "[Play]"}</text>
				</box>
				<box
					border
					padding={0}
					onMouseDown={props.onNext}
					borderColor={theme.border}
				>
					<text fg={theme.primary} wrapMode="none">[Next]</text>
				</box>
			</box>
			{/* status group — always follows the buttons; wrap point is here */}
			<box
				flexDirection="row"
				gap={1}
				alignItems="center"
				marginLeft={2}
				flexShrink={0}
			>
				<text fg={theme.textMuted}>Vol</text>
				<text fg={theme.text}>{Math.round(props.volume * 100)}%</text>
				<text fg={theme.textMuted}>↑↓</text>
				<box flexDirection="row" gap={1} marginLeft={2}>
					<text fg={theme.textMuted}>Speed</text>
					<text fg={theme.text}>{props.speed}x</text>
					<text fg={theme.textMuted}>S</text>
				</box>
			</box>
			{/* audio warnings — wrap to their own (3rd) line when the row is tight */}
			{(props.backendName === "none" || props.hasAudioUrl === false) && (
				<box
					flexDirection="row"
					gap={1}
					alignItems="center"
					flexShrink={0}
				>
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
			)}
		</box>
	);
}
