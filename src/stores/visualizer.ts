/**
 * visualizer-store — module-level singleton owning the realtime waveform
 * pipeline (ffmpeg decode + cavacore FFT), shared across PlayerPage mounts.
 *
 * The pipeline lives here rather than in the Player page component so it can
 * outlive the page: Shell unmounts a tab's page the moment the tab loses
 * focus, which would otherwise kill the ffmpeg decode + FFT loop instantly.
 * Instead the store keeps the visualization warm for UNLOAD_DELAY_MS after
 * the Player tab stops being focused, then tears it down (kills ffmpeg,
 * destroys the cava plan). Returning to the tab within the delay resumes
 * seamlessly; after an unload, regaining focus restarts the pipeline from
 * the current playback position.
 *
 * The store subscribes to the module-level playback signals in
 * `utils/audio-signals.ts` (`audioPlaybackSignals`), so it reacts to
 * play/pause/seek/speed even while no Player page is mounted. `focused` is
 * fed by PlayerPage (mounted ⇔ Player tab visible), `barCount` by
 * RealtimeWaveform (terminal width).
 */

import {
	createSignal,
	createEffect,
	createRoot,
	on,
	untrack,
} from "solid-js";
import {
	loadCavaCore,
	type CavaCore,
	type CavaCoreConfig,
} from "@/utils/cavacore";
import { AudioStreamReader } from "@/utils/audio-stream-reader";
import { createBarScaler } from "@/utils/bar-mapping";
import { audioPlaybackSignals } from "@/utils/audio-signals";
import { useAppStore } from "@/stores/app";

// ── Constants ────────────────────────────────────────────────────────────

/** How long the pipeline keeps running after the Player tab loses focus. */
export const VISUALIZER_UNLOAD_DELAY_MS = 30_000;

/** Target frame interval in ms (~30 fps) */
const FRAME_INTERVAL = 33;

/** Number of PCM samples to read per frame (512 is a good FFT window) */
const SAMPLES_PER_FRAME = 512;

// ── Types ────────────────────────────────────────────────────────────────

export interface VisualizerStore {
	/** Frequency bar values (0.0–1.0 per bar), empty until the first frame. */
	barData: () => number[];
	/** True from pipeline start until the first complete FFT frame renders. */
	isLoading: () => boolean;
	/** True while the ~30fps render loop is armed. */
	isRunning: () => boolean;
	/** Report whether the Player tab is the visible tab. */
	setFocused: (focused: boolean) => void;
	/** Report the terminal-width-derived bar count (resize re-inits). */
	setBarCount: (count: number) => void;
}

// ── Store factory ────────────────────────────────────────────────────────

function createVisualizerStore(): VisualizerStore {
	// Frequency bar values (0.0–1.0 per bar)
	const [barData, setBarData] = createSignal<number[]>([]);

	// True from pipeline start until the first complete FFT frame renders.
	const [isLoading, setIsLoading] = createSignal(false);

	// Whether the Player tab is the visible tab (fed by PlayerPage).
	const [focused, setFocused] = createSignal(false);

	// Width-derived bar count (fed by RealtimeWaveform; default before the
	// renderer reports a real size).
	const [barCount, setBarCount] = createSignal(64);

	// Peak-follower scaler replaces cava's autosens: normalizes each FFT
	// frame against the running peak so a loud start can't pin every bar
	// at full height and quiet content still gets normalized up.
	const scaler = createBarScaler();

	let cava: CavaCore | null = null;
	let reader: AudioStreamReader | null = null;
	let frameTimer: ReturnType<typeof setInterval> | null = null;
	let sampleBuffer: Float64Array | null = null;
	let unloadTimer: ReturnType<typeof setTimeout> | null = null;

	// What the running pipeline was started with — lets the playback effect
	// tell "nothing changed, stay warm" from "must restart".
	let activeUrl = "";
	let activeSpeed = 1;
	let activeBars = 64;

	// ── Lifecycle helpers ──────────────────────────────────────────────

	const clearUnloadTimer = () => {
		if (unloadTimer) {
			clearTimeout(unloadTimer);
			unloadTimer = null;
		}
	};

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
	// polls, interpolate the position from wall time so the FFT window
	// tracks the audio continuously instead of stepping. The 0.5s cap
	// prevents extrapolating far beyond reality when the player stalls
	// (e.g. network re-buffering).

	let lastPolledPosition = 0;
	let lastPolledAt = 0;
	const smoothPosition = () => {
		const pos = audioPlaybackSignals.position();
		const now = performance.now();
		if (pos !== lastPolledPosition) {
			lastPolledPosition = pos;
			lastPolledAt = now;
			return pos;
		}
		if (lastPolledAt === 0) return pos;
		const elapsed = Math.min((now - lastPolledAt) / 1000, 0.5);
		return lastPolledPosition + elapsed * (audioPlaybackSignals.speed() ?? 1);
	};

	// ── Start/stop the visualization pipeline ──────────────────────────

	const startVisualization = (url: string, position: number, speed: number) => {
		stopVisualization();

		if (!url || !initCava() || !cava) return;

		// Initialize cavacore with current resolution + the user's
		// audio-processing params (noise reduction, cutoffs, etc.).
		// autosens is disabled (after the spread so it always wins): cava's
		// autosens gain-ramps during silence then clips everything to 1.0
		// when audio arrives — the JS peak scaler handles dynamics instead.
		const viz = useAppStore().state().settings.visualizer;
		const config: CavaCoreConfig = {
			bars: barCount(),
			sampleRate: 44100,
			channels: 1,
			noiseReduction: viz.noiseReduction,
			lowCutOff: viz.lowCutOff,
			highCutOff: viz.highCutOff,
			autosens: 0,
		};
		cava.init(config);

		// Pre-warm the FFT window: libcavacore's window is malloc'd
		// uninitialized, so the first real frame would FFT garbage and
		// render full-scale bars. One zero frame the size of the whole
		// input buffer clears it (at 44.1kHz mono the window is 8192
		// samples — FFTbassbufferSize × channels; a 512-sample frame would
		// leave the tail garbage).
		cava.execute(new Float64Array(8192));

		// Pre-allocate sample read buffer
		sampleBuffer = new Float64Array(SAMPLES_PER_FRAME);

		// Start ffmpeg decode stream (reuse reader if same URL, else create new)
		if (!reader || reader.url !== url) {
			if (reader) reader.stop();
			reader = new AudioStreamReader({ url });
		}
		reader.start(position, speed);

		// Seed the smooth position clock with the start position. Without
		// this, a fresh play at position 0 would sample the window ending at
		// exactly 0 — a 1-sample slice the reader can never fill — so the
		// bars would be starved until the first mpv poll advanced the
		// position clock. Seeding makes the interpolated target advance
		// immediately, so bars render as soon as ffmpeg has any audio.
		lastPolledPosition = position;
		lastPolledAt = performance.now();

		activeUrl = url;
		activeSpeed = speed;
		activeBars = barCount();
		setIsLoading(true);
		frameTimer = setInterval(renderFrame, FRAME_INTERVAL);
	};

	const stopVisualization = () => {
		clearUnloadTimer();
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
		setIsLoading(false);
	};

	// ── Render loop (called at ~30fps) ─────────────────────────────────

	const renderFrame = () => {
		if (!cava?.isReady || !reader?.running || !sampleBuffer) return;

		// Sample the FFT window at the player's position, not the decode
		// head — the reader decodes independently (paced at the player's
		// clock rate with a LEAD_SECONDS burst head start) and only the
		// position clock ties the bars to what's actually playing.
		const target = smoothPosition();
		const count = reader.read(sampleBuffer, target);
		// Never feed a partial FFT window to cava.
		if (count < sampleBuffer.length) return;

		const output = cava.execute(sampleBuffer);

		// Normalize against the running peak and copy to a new array
		setBarData(scaler(output));
		if (isLoading()) setIsLoading(false);
	};

	// ── Playback subscription ──────────────────────────────────────────
	//
	// Keeps the pipeline matched to playback. `focused` is a dep so focus
	// regain re-evaluates (and can restart an unloaded pipeline), but the
	// guard below makes a focus flip on an already-correct warm pipeline a
	// no-op — no churn when flipping back to the Player tab within the
	// unload delay. A real change (url/speed/barCount, stop/start, or a
	// stale pipeline after an unload) restarts from the current position.

	createEffect(
		on(
			[
				audioPlaybackSignals.isPlaying,
				() => audioPlaybackSignals.currentEpisode()?.audioUrl ?? "",
				audioPlaybackSignals.speed,
				barCount,
				focused,
				() => useAppStore().state().settings.visualizer.enabled,
			],
			([playing, url, speed, , , enabled]) => {
				if (!playing || !url || !enabled) {
					stopVisualization();
					return;
				}
				// Warm and already correct — nothing to do (e.g. focus
				// regained within the unload delay).
				if (
					frameTimer !== null &&
					url === activeUrl &&
					speed === activeSpeed &&
					barCount() === activeBars
				) {
					return;
				}
				if (!focused()) return; // playing away: stay warm; unload timer decides
				startVisualization(
					url,
					untrack(audioPlaybackSignals.position),
					speed,
				);
			},
		),
	);

	// ── Focus subscription: unload after the grace delay ───────────────

	createEffect(
		on(focused, (f) => {
			clearUnloadTimer();
			if (f) {
				// Pipeline was unloaded (or never started) but playback is
				// still going — restart from the current position. When the
				// pipeline is warm the playback effect above is the one that
				// acts (guard: no-op for an unchanged warm pipeline).
				if (
					audioPlaybackSignals.isPlaying() &&
					audioPlaybackSignals.currentEpisode()?.audioUrl &&
					useAppStore().state().settings.visualizer.enabled &&
					frameTimer === null
				) {
					startVisualization(
						audioPlaybackSignals.currentEpisode()!.audioUrl,
						untrack(audioPlaybackSignals.position),
						audioPlaybackSignals.speed() ?? 1,
					);
				}
			} else if (frameTimer !== null) {
				unloadTimer = setTimeout(() => {
					unloadTimer = null;
					stopVisualization();
				}, VISUALIZER_UNLOAD_DELAY_MS);
			}
		}),
	);

	// ── Seek detection: lightweight effect for position jumps ──────────
	//
	// Watches position and restarts the reader (not the whole pipeline)
	// only on significant jumps (>2s), which indicate a user seek.
	// This is intentionally a separate effect — it should NOT trigger a
	// full pipeline restart, just restart the ffmpeg stream at the new pos.

	let lastSyncPosition = 0;
	createEffect(
		on(audioPlaybackSignals.position, (pos) => {
			if (!audioPlaybackSignals.isPlaying() || !reader?.running) {
				lastSyncPosition = pos;
				return;
			}

			const delta = Math.abs(pos - lastSyncPosition);
			lastSyncPosition = pos;

			if (delta > 2) {
				reader.restart(pos, audioPlaybackSignals.speed() ?? 1);
			}
		}),
	);

	return {
		// state
		barData,
		isLoading,
		isRunning: () => frameTimer !== null,
		// inputs
		setFocused,
		setBarCount,
	};
}

// ── Singleton ─────────────────────────────────────────────────────────────

let visualizerStoreInstance: VisualizerStore | null = null;

/**
 * Accessor for the shared visualizer store. Created once inside a
 * `createRoot` so its effects are owned by a detached root — not by
 * whichever component happens to call first (PlayerPage unmounts would
 * otherwise dispose the pipeline effects with it).
 */
export function useVisualizer(): VisualizerStore {
	if (!visualizerStoreInstance) {
		visualizerStoreInstance = createRoot(() => createVisualizerStore());
	}
	return visualizerStoreInstance;
}
