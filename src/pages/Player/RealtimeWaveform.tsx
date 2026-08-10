/**
 * RealtimeWaveform — live audio frequency visualization using cavacore.
 *
 * Spawns an independent ffmpeg
 * process to decode the audio stream, feeds PCM samples through cavacore
 * for FFT analysis, and renders frequency bars as colored terminal
 * characters at ~30fps.
 */

import { createSignal, createEffect, onCleanup, on, untrack } from "solid-js";
import { useTerminalDimensions } from "@opentui/solid";
import {
	loadCavaCore,
	type CavaCore,
	type CavaCoreConfig,
} from "@/utils/cavacore";
import { AudioStreamReader } from "@/utils/audio-stream-reader";
import { useAudio } from "@/hooks/useAudio";
import { useTheme } from "@/context/ThemeContext";
import { PANE_RATIO } from "@/utils/navigation";

// ── Types ────────────────────────────────────────────────────────────

export type RealtimeWaveformProps = {
	visualizerConfig?: Partial<CavaCoreConfig>;
};

/** Unicode lower block elements: space (silence) through full block (max) */
const BARS = [
	" ",
	"\u2581",
	"\u2582",
	"\u2583",
	"\u2584",
	"\u2585",
	"\u2586",
	"\u2587",
	"\u2588",
];

/** Target frame interval in ms (~30 fps) */
const FRAME_INTERVAL = 33;

/** Number of PCM samples to read per frame (512 is a good FFT window) */
const SAMPLES_PER_FRAME = 512;

// ── Component ────────────────────────────────────────────────────────

export function RealtimeWaveform(props: RealtimeWaveformProps) {
	const { theme } = useTheme();
	const audio = useAudio();

	// Frequency bar values (0.0–1.0 per bar)
	const [barData, setBarData] = createSignal<number[]>([]);

	let cava: CavaCore | null = null;
	let reader: AudioStreamReader | null = null;
	let frameTimer: ReturnType<typeof setInterval> | null = null;
	let sampleBuffer: Float64Array | null = null;

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

	// ── Lifecycle: init cavacore once ──────────────────────────────────

	const initCava = () => {
		if (cava) return true;

		cava = loadCavaCore();
		if (!cava) {
			return false;
		}

		return true;
	};

	// ── Smooth position clock ──────────────────────────────────────────
	//
	// audio.position() updates at the useAudio poll rate (~150ms). Between
	// polls, interpolate the position from wall time so the FFT window (and
	// the played/future split) tracks the audio continuously instead of
	// stepping. The 0.5s cap prevents extrapolating far beyond reality when
	// the player stalls (e.g. network re-buffering).

	let lastPolledPosition = 0;
	let lastPolledAt = 0;
	const smoothPosition = () => {
		const pos = audio.position();
		const now = performance.now();
		if (pos !== lastPolledPosition) {
			lastPolledPosition = pos;
			lastPolledAt = now;
			return pos;
		}
		if (lastPolledAt === 0) return pos;
		const elapsed = Math.min((now - lastPolledAt) / 1000, 0.5);
		return lastPolledPosition + elapsed * (audio.speed() ?? 1);
	};

	// ── Start/stop the visualization pipeline ──────────────────────────

	const startVisualization = (url: string, position: number, speed: number) => {
		stopVisualization();

		if (!url || !initCava() || !cava) return;

		// Initialize cavacore with current resolution + any overrides.
		// bars is width-derived (see numBars); visualizerConfig supplies the
		// audio-processing params (noise reduction, cutoffs, etc.).
		const config: CavaCoreConfig = {
			bars: numBars(),
			sampleRate: 44100,
			channels: 1,
			...props.visualizerConfig,
		};
		cava.init(config);

		// Pre-allocate sample read buffer
		sampleBuffer = new Float64Array(SAMPLES_PER_FRAME);

		// Start ffmpeg decode stream (reuse reader if same URL, else create new)
		if (!reader || reader.url !== url) {
			if (reader) reader.stop();
			reader = new AudioStreamReader({ url });
		}
		reader.start(position, speed);

		frameTimer = setInterval(renderFrame, FRAME_INTERVAL);
	};

	const stopVisualization = () => {
		if (frameTimer) {
			clearInterval(frameTimer);
			frameTimer = null;
		}
		if (reader) {
			reader.stop();
			// Don't null reader — we reuse it across start/stop cycles
		}
		if (cava?.isReady) {
			cava.destroy();
		}
		sampleBuffer = null;
	};

	// ── Render loop (called at ~30fps) ─────────────────────────────────

	const renderFrame = () => {
		if (!cava?.isReady || !reader?.running || !sampleBuffer) return;

		// Sample the FFT window at the player's position, not the decode
		// head — the reader decodes independently and only the position clock
		// ties the bars to what's actually playing.
		const target = smoothPosition();
		const count = reader.read(sampleBuffer, target);
		if (count === 0) return;

		const input =
			count < sampleBuffer.length
				? sampleBuffer.subarray(0, count)
				: sampleBuffer;
		const output = cava.execute(input);

		// Copy bar values to a new array for the signal
		setBarData(Array.from(output as Float64Array));
	};

	createEffect(
		on(
			[
				audio.isPlaying,
				() => audio.currentEpisode()?.audioUrl ?? "",
				audio.speed,
				numBars,
			],
			([playing, url, speed]) => {
				if (playing && url) {
					const pos = untrack(audio.position);
					startVisualization(url, pos, speed);
				} else {
					stopVisualization();
				}
			},
		),
	);

	// ── Seek detection: lightweight effect for position jumps ──────────
	//
	// Watches position and restarts the reader (not the whole pipeline)
	// only on significant jumps (>2s), which indicate a user seek.
	// This is intentionally a separate effect — it should NOT trigger a
	// full pipeline restart, just restart the ffmpeg stream at the new pos.

	let lastSyncPosition = 0;
	createEffect(
		on(audio.position, (pos) => {
			if (!audio.isPlaying || !reader?.running) {
				lastSyncPosition = pos;
				return;
			}

			const delta = Math.abs(pos - lastSyncPosition);
			lastSyncPosition = pos;

			if (delta > 2) {
				reader.restart(pos, audio.speed() ?? 1);
			}
		}),
	);

	onCleanup(() => {
		stopVisualization();
		if (reader) {
			reader.stop();
			reader = null;
		}
		// Don't null cava itself — it can be reused. But do destroy its plan.
		if (cava?.isReady) {
			cava.destroy();
		}
	});

	// ── Rendering ──────────────────────────────────────────────────────

	const playedRatio = () =>
		audio.duration() <= 0
			? 0
			: Math.min(1, smoothPosition() / audio.duration());

	const renderLine = () => {
		const bars = barData();
		const count = numBars();

		if (bars.length === 0) {
			const placeholder = ".".repeat(count);
			return (
				<box flexDirection="row" gap={0}>
					<text fg="#3b4252">{placeholder}</text>
				</box>
			);
		}

		const played = Math.floor(count * playedRatio());
		const playedColor = audio.isPlaying() ? "#6fa8ff" : "#7d8590";
		const futureColor = "#3b4252";

		const playedChars = bars
			.slice(0, played)
			.map((v) => BARS[Math.min(BARS.length - 1, Math.floor(v * BARS.length))])
			.join("");

		const futureChars = bars
			.slice(played)
			.map((v) => BARS[Math.min(BARS.length - 1, Math.floor(v * BARS.length))])
			.join("");

		return (
			<box flexDirection="row" gap={0}>
				<text fg={playedColor}>{playedChars || " "}</text>
				<text fg={futureColor}>{futureChars || " "}</text>
			</box>
		);
	};

	const handleClick = (event: { x: number }) => {
		const count = numBars();
		const ratio = event.x / count;
		const next = Math.max(
			0,
			Math.min(audio.duration(), Math.round(audio.duration() * ratio)),
		);
		audio.seek(next);
	};

	return (
		<box
			border
			borderColor={theme.border}
			padding={1}
			onMouseDown={handleClick}
		>
			{renderLine()}
		</box>
	);
}
