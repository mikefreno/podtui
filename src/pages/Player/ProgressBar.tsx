/**
 * ProgressBar — one-row, click-to-seek playback progress bar for the
 * player pane. Played portion renders as full blocks (█) in the theme's
 * primary color, the remainder as light shade blocks (░) in the muted
 * color. The header time/percent text lives in PlayerPage — this is only
 * the bar itself.
 */

import { useTerminalDimensions } from "@opentui/solid";
import { useAudio } from "@/hooks/useAudio";
import { useTheme } from "@/context/ThemeContext";

// ── Component ────────────────────────────────────────────────────────

export function ProgressBar() {
	const audio = useAudio();
	const { theme } = useTheme();
	const dimensions = useTerminalDimensions();

	// Full content width of the player pane: the player is a 2-pane row
	// (parent 1/5 + current 4/5 of the terminal width). Subtract ~8 chars
	// of border/padding chrome (same math as RealtimeWaveform's numBars).
	const width = () => Math.max(8, Math.floor((dimensions().width * 4) / 5) - 8);

	const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

	const playedChars = () => {
		const duration = audio.duration();
		if (duration <= 0) return 0;
		return Math.round(clamp01(audio.position() / duration) * width());
	};

	const remainingColor = theme.muted || theme.text;

	return (
		<box
			border
			borderColor={theme.border}
			padding={0}
			flexDirection="row"
			gap={0}
			onMouseDown={(e: { x: number }) => {
				const duration = audio.duration();
				if (duration <= 0) return;
				// e.x = 0 is the box border; content starts at x = 1.
				const ratio = Math.max(0, Math.min(1, (e.x - 1) / width()));
				void audio.seek(ratio * duration);
			}}
		>
			<text fg={theme.primary}>{"\u2588".repeat(playedChars())}</text>
			<text fg={remainingColor}>
				{"\u2591".repeat(width() - playedChars())}
			</text>
		</box>
	);
}
