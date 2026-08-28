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
 * a braille spinner while the pipeline is loading its first frames or the
 * player is stalled (re-buffering), the frequency bars once frames arrive,
 * and a dotted placeholder when idle.
 */

import { createEffect, on } from "solid-js";
import { useTerminalDimensions } from "@opentui/solid";
import { useVisualizer } from "@/stores/visualizer";
import { useTheme } from "@/context/ThemeContext";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { BAR_LEVELS, barChars } from "@/utils/bar-mapping";
import { usePaneLayout } from "@/stores/pane-layout";

// ── Component ────────────────────────────────────────────────────────

export function RealtimeWaveform() {
	const { theme } = useTheme();
	const viz = useVisualizer();

	const dimensions = useTerminalDimensions();
	const layout = usePaneLayout();
	const numBars = () => {
		const width = dimensions().width;
		if (!width) return 64;
		// The player is a 2-pane row: the current column = whole width minus
		// the parent (left split). Subtract ~8 chars of chrome.
		return Math.max(
			8,
			Math.min(256, Math.floor(width * (1 - layout.splits().left)) - 8),
		);
	};

	// Keep the store's bar count in sync with the terminal width; the store
	// re-inits the running pipeline when it changes (terminal resize).
	createEffect(on(numBars, (n) => viz.setBarCount(n)));

	// ── Rendering ──────────────────────────────────────────────────────

	const renderLine = () => {
		const bars = viz.barData();
		const count = numBars();

		// Loading state: the braille spinner shows while the pipeline is
		// warming up — cold start (first play / after an unload), resume
		// into undecoded audio, or a stalled position clock (mpv
		// re-buffering after a long pause on a network stream). The store
		// clears it the moment the first fresh frame renders, so stale
		// bars never masquerade as live data while the pipeline re-arms.
		if (viz.isLoading() || viz.isStalled()) {
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
