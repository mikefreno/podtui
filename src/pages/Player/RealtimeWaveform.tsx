/**
 * RealtimeWaveform — renders the shared visualizer pipeline state.
 *
 * The pipeline (ffmpeg decode + cavacore FFT) lives in the module-level
 * visualizer store (`@/stores/visualizer`), not in this component, so it
 * survives PlayerPage unmounts: leaving the Player tab keeps the waveform
 * warm for VISUALIZER_UNLOAD_DELAY_MS, then the store tears it down.
 *
 * This component only subscribes to store state, reports the width-derived
 * bar count (terminal resize re-inits the running pipeline), and renders:
 * a braille spinner while the pipeline is loading its first frames, the
 * frequency bars once frames arrive, and a dotted placeholder when idle.
 */

import { createEffect, on } from "solid-js";
import { useTerminalDimensions } from "@opentui/solid";
import { useVisualizer } from "@/stores/visualizer";
import { useTheme } from "@/context/ThemeContext";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { BAR_LEVELS, barChars } from "@/utils/bar-mapping";
import { PANE_RATIO } from "@/utils/navigation";

// ── Component ────────────────────────────────────────────────────────

export function RealtimeWaveform() {
	const { theme } = useTheme();
	const viz = useVisualizer();

	// Bar count scales with terminal width so the waveform fills its pane.
	// The player is a 2-pane row: current column = (current+preview) of
	// (parent+current+preview) of the terminal width. Subtract ~8 chars of
	// chrome (scrollbox border + box padding + waveform border + padding).
	// Falls back to 64 before the renderer reports a real size.
	const dimensions = useTerminalDimensions();
	const numBars = () => {
		const total = PANE_RATIO.parent + PANE_RATIO.current + PANE_RATIO.preview;
		const current = PANE_RATIO.current + PANE_RATIO.preview; // 2-pane grows current
		const width = dimensions().width;
		if (!width) return 64;
		return Math.max(
			8,
			Math.min(256, Math.floor((width * current) / total) - 8),
		);
	};

	// Keep the store's bar count in sync with the terminal width; the store
	// re-inits the running pipeline when it changes (terminal resize).
	createEffect(on(numBars, (n) => viz.setBarCount(n)));

	// ── Rendering ──────────────────────────────────────────────────────

	const renderLine = () => {
		const bars = viz.barData();
		const count = numBars();

		// Loading state: the braille spinner shows while the pipeline warms
		// up — but only when there are no bars to render yet (first play /
		// after an unload). On resume/seek the last bars stay on screen
		// until fresh frames arrive, so the waveform never blanks out for
		// the (multi-second, network-bound) cold start.
		if (bars.length === 0 && viz.isLoading()) {
			return <LoadingIndicator />;
		}

		if (bars.length === 0) {
			const placeholder = ".".repeat(count);
			return (
				<box flexDirection="column" gap={0}>
					<text fg={theme.primary}>{placeholder}</text>
					<text fg={theme.primary}>{placeholder}</text>
				</box>
			);
		}

		const pairs = bars.map((v) => barChars(Math.floor(v * BAR_LEVELS)));
		const top = pairs.map((pair) => pair.top).join("");
		const bottom = pairs.map((pair) => pair.bottom).join("");

		return (
			<box flexDirection="column" gap={0}>
				<text fg={theme.primary}>{top}</text>
				<text fg={theme.primary}>{bottom}</text>
			</box>
		);
	};

	return (
		<box border borderColor={theme.border} padding={1}>
			{renderLine()}
		</box>
	);
}
