/**
 * ProgressBar — one-row, click-to-seek playback progress bar for the
 * player pane. Played portion renders as full blocks (█) in the theme's
 * primary color, the remainder as light shade blocks (░) in the muted
 * color. The header time/percent text lives in PlayerPage — this is only
 * the bar itself.
 */

import { useTerminalDimensions } from "@opentui/solid";
import type { Renderable } from "@opentui/core";
import { useAudio } from "@/hooks/useAudio";
import { useTheme } from "@/context/ThemeContext";

// ── Component ────────────────────────────────────────────────────────

export function ProgressBar() {
	const audio = useAudio();
	const { theme } = useTheme();
	const dimensions = useTerminalDimensions();

	// The bar's renderable, captured for its absolute left edge: MouseEvent.x
	// is terminal-absolute (not bar-relative), so local x needs the offset
	// of the bar inside the 2-pane row (parent pane ≈ 20% of the width).
	let bar: Renderable | undefined;

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
			// The bar's block-char texts are non-selectable below: a drag
			// over the bar is a seek gesture, not a text selection — otherwise
			// mouse-up would copy █/░ to the clipboard via the global
			// selection handler.
			ref={(el) => {
				bar = el;
			}}
			onMouseDown={(e: { x: number }) => {
				const duration = audio.duration();
				if (duration <= 0 || !bar) return;
				// localX = 0 is the box border; content starts at localX = 1.
				const localX = e.x - bar.x;
				const ratio = Math.max(0, Math.min(1, (localX - 1) / width()));
				void audio.seek(ratio * duration);
			}}
		>
			{playedChars() > 0 && (
				<text fg={theme.primary} selectable={false}>
					{"\u2588".repeat(playedChars())}
				</text>
			)}
			<text fg={remainingColor} selectable={false}>
				{"\u2591".repeat(width() - playedChars())}
			</text>
		</box>
	);
}
