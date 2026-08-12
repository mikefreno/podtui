/**
 * visualizer-store — module-level singleton owning the realtime waveform
 * pipeline (ffmpeg decode + cavacore FFT), shared across PlayerPage mounts.
 *
 * Pipeline shape (see utils/audio-pcm-cache.ts for the rationale):
 * an ffmpeg process decodes the episode at full speed into a
 * position-indexed PCM cache; the render loop reads the window ending at
 * the player's current position from that cache. Because reads are
 * indexed by playback time, PAUSE/RESUME/SEEK/SPEED need no pipeline
 * choreography at all — and cannot desync:
 *
 * - Pause: stop the render loop and the decode pass; the PCM cache stays
 *   resident. Bars freeze on the last rendered frame.
 * - Resume: re-arm the render loop — bars render instantly from the cache
 *   — and continue the tail decode in the background. No cold start, no
 *   coverage guessing, no clamped-buffer freeze (the old bug: resume
 *   re-armed the loop over a DEAD ffmpeg and the bars exhausted the ring
 *   buffer, then froze on a repeated stale window forever).
 * - Seek into decoded audio: nothing to do. Seek into a hole: kick off a
 *   decode segment there; the last frame holds until data arrives.
 * - Speed changes: nothing. The cache is position-indexed raw PCM.
 *
 * Focus lifecycle: Shell unmounts a tab's page when it loses focus, but the
 * pipeline outlives the page so playback keeps visualizing; UNLOAD_DELAY_MS
 * after the Player tab stops being focused it tears down. Reads outside
 * decoded coverage return empty — the renderer simply holds the last frame
 * until the decode frontier arrives.
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
import { EpisodePcmCache, PCM_SAMPLE_RATE } from "@/utils/audio-pcm-cache";
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

/** Timer handle as returned by setTimeout/setInterval in this runtime. */
type TimerHandle = ReturnType<typeof setTimeout>;

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
	// Position-indexed PCM cache for the current episode. Kept across
	// pause/resume (segments survive; only the ffmpeg pass is killed) and
	// dropped only on episode change, stop, disable, or unload.
	let pcm: EpisodePcmCache | null = null;
	let frameTimer: TimerHandle | null = null;
	let sampleBuffer: Float64Array | null = null;
	let unloadTimer: TimerHandle | null = null;

	// What the running pipeline was started with — lets the playback effect
	// tell "nothing changed, stay warm" from "must restart".
	let activeUrl = "";
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

	const startVisualization = (url: string, position: number) => {
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
			sampleRate: PCM_SAMPLE_RATE,
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
		// input buffer clears it.
		cava.execute(new Float64Array(8192));

		// Pre-allocate sample read buffer
		sampleBuffer = new Float64Array(SAMPLES_PER_FRAME);

		// PCM cache per episode (reuse when the episode is unchanged)
		if (!pcm || pcm.url !== url) {
			if (pcm) pcm.stop();
			pcm = new EpisodePcmCache({ url });
		}
		// Decode from 1s before the position so the window ENDING at the
		// position is covered as soon as the first PCM lands.
		pcm.startDecode(Math.max(0, position - 1));

		// Seed the smooth position clock with the start position. Without
		// this, a fresh play at position 0 would sample the window ending at
		// exactly 0 — a 1-sample slice — so bars would be starved until the
		// first mpv poll advanced the position clock.
		lastPolledPosition = position;
		lastPolledAt = performance.now();

		activeUrl = url;
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
		clearTimeout(seekDecodeTimer);
		seekDecodeTimer = undefined;
		if (pcm) {
			pcm.stop();
			// Keep the (now cache-less, url-tagged) object: a re-start of the
			// same episode reuses it; segments re-decode in seconds at 80x.
		}
		if (cava?.isReady) {
			cava.destroy();
		}
		sampleBuffer = null;
		setIsLoading(false);
	};

	// ── Pause: freeze the loop, keep the cache ──────────────────────────
	//
	// The render loop stops (bars hold their last frame) and the ffmpeg
	// pass dies (no background CPU), but the decoded PCM stays: resume
	// serves it instantly.

	const suspendVisualization = () => {
		clearUnloadTimer();
		if (frameTimer) {
			clearInterval(frameTimer);
			frameTimer = null;
		}
		// Cancel any debounced seek-decode: it would restart ffmpeg while
		// paused, defeating the "no background CPU while paused" contract.
		clearTimeout(seekDecodeTimer);
		seekDecodeTimer = undefined;
		if (pcm) pcm.pauseDecode();
		// Cava plan + sampleBuffer stay alive — cheap to reuse on resume.
		// Clear the loading spinner: if the pipeline never produced bars
		// (still cold-starting when paused), the component should fall back
		// to the placeholder, not freeze on a spinner.
		setIsLoading(false);
	};

	// ── Resume: re-arm the render loop, top up the cache ───────────────
	//
	// Returns true if the pipeline resumed, false if there was nothing to
	// resume (no prior pipeline).

	const resumeVisualization = (): boolean => {
		// Already running — nothing to do.
		if (frameTimer !== null) return true;
		if (!pcm || !cava?.isReady || !sampleBuffer) return false;

		const pos = untrack(audioPlaybackSignals.position);

		// Bars come from the cache on the next frame tick (~33ms) whenever
		// the position is covered; any gap (uncached region) restarts the
		// decode pass in the background with the last frame holding.
		pcm.ensureDecodeAround(pos);

		lastPolledPosition = pos;
		lastPolledAt = performance.now();
		frameTimer = setInterval(renderFrame, FRAME_INTERVAL);
		return true;
	};

	// ── Render loop (called at ~30fps) ─────────────────────────────────

	const renderFrame = () => {
		if (!cava?.isReady || !sampleBuffer || !pcm) return;

		// Sample the FFT window at the player's position. Outside decoded
		// coverage (decode cold start, seek into a hole) the read is empty
		// and the LAST FRAME simply holds — never clamped/repeated junk.
		const target = smoothPosition();
		const count = pcm.readWindow(sampleBuffer, target);
		// Never feed a partial FFT window to cava.
		if (count < sampleBuffer.length) return;

		const output = cava.execute(sampleBuffer);

		// Normalize against the running peak and copy to a new array
		setBarData(scaler(output));
		if (isLoading()) setIsLoading(false);
	};

	// ── Playback subscription ──────────────────────────────────────────
	//
	// Keeps the pipeline matched to playback. Pause suspends (render loop +
	// decode pass die, cache survives) so resume is instant. Stop/track-end/
	// disable fully tears down. `focused` is a dep so focus regain
	// re-evaluates; the guards make a focus flip on an already-correct warm
	// pipeline a no-op. Speed is deliberately NOT a dep — the PCM cache is
	// position-indexed, so playback-rate changes need no pipeline restart.

	createEffect(
		on(
			[
				audioPlaybackSignals.isPlaying,
				() => audioPlaybackSignals.currentEpisode()?.audioUrl ?? "",
				barCount,
				focused,
				() => useAppStore().state().settings.visualizer.enabled,
			],
			([playing, url, , , enabled]) => {
				if (!url || !enabled) {
					stopVisualization();
					return;
				}
				if (!playing) {
					// Pause: freeze the loop, keep the cache. Only if the
					// pipeline is actually running — otherwise no-op.
					if (frameTimer !== null) suspendVisualization();
					return;
				}

				// Playing — try a fast resume first. If it succeeds and the
				// pipeline matches, done.
				if (
					frameTimer === null &&
					pcm &&
					cava?.isReady &&
					url === activeUrl &&
					barCount() === activeBars
				) {
					if (resumeVisualization()) return;
				}

				// Warm and already correct — nothing to do (e.g. focus
				// regained within the unload delay while still playing).
				if (frameTimer !== null && url === activeUrl && barCount() === activeBars) {
					return;
				}
				if (!focused()) return; // playing away: stay warm; unload timer decides
				startVisualization(url, untrack(audioPlaybackSignals.position));
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

	// ── Seek detection: jump coverage, not pipeline restarts ───────────
	//
	// Watches position for significant jumps (>2s = user seek). Decoded
	// audio at the new position is served instantly with zero action; a
	// jump into an undecoded hole kicks a background segment decode there
	// while the last frame holds.

	let lastSyncPosition = 0;
	let seekDecodeTimer: TimerHandle | undefined;
	createEffect(
		on(audioPlaybackSignals.position, (pos) => {
			if (!audioPlaybackSignals.isPlaying() || !pcm) {
				lastSyncPosition = pos;
				return;
			}

			const delta = Math.abs(pos - lastSyncPosition);
			lastSyncPosition = pos;

			if (delta > 2) {
				// Debounce: holding the seek key fires a jump per poll tick —
				// without debounce each one restarts ffmpeg, spamming network
				// reconnects against the stream's server. Wait for the user to
				// settle, then decode at the final position.
				clearTimeout(seekDecodeTimer);
				const target = pcm; // capture for the timer
				seekDecodeTimer = setTimeout(() => {
					seekDecodeTimer = undefined;
					target.ensureDecodeAround(untrack(audioPlaybackSignals.position));
				}, 400);
			}
		}),
	);
	// ── Process-exit teardown ──────────────────────────────────────────
	//
	// The pipeline lives in a detached createRoot that is never disposed,
	// so Solid's onCleanup never runs. `q`/`:quit` call process.exit(0)
	// (bypassing onCleanup); SIGINT/TERM/HUP are caught by useAudio's
	// handler. This handler runs synchronously on `exit` and kills the
	// ffmpeg child + destroys the cava plan so they don't outlive the host.
	// Without it, a warm pipeline leaks an orphaned ffmpeg process on quit.
	process.on("exit", () => {
		stopVisualization();
	});

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
