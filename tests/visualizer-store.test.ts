/**
 * Visualizer store lifecycle tests — pin the waveform pipeline contract:
 *
 *  - playback starts the pipeline and exposes a loading state until the
 *    first FFT frame renders (the braille-spinner window);
 *  - losing Player-tab focus does NOT kill a warm pipeline — it keeps
 *    rendering for the grace period, and regaining focus within the delay
 *    resumes it without a restart;
 *  - after VISUALIZER_UNLOAD_DELAY_MS unfocused the pipeline tears down
 *    (ffmpeg process + cava plan released).
 *
 * The store subscribes to the module-level signals in utils/audio-signals.ts
 * (no useAudio mock — the signals are exported and driven directly, so this
 * file can never leak a module mock into another test's worker).
 *
 * Uses a self-generated local WAV (a frequency chirp, so different playback
 * positions produce measurably different bar output) and the real ffmpeg +
 * native cavacore pipeline, mirroring audio-pcm-cache.test.ts.
 *
 * Timing note: this is an integration test of the store's real timers — the
 * unload path is a genuine `setTimeout` in the store, and bun 1.3.8 ships no
 * fake-timer API (no `mock.timer`, no `vi.useFakeTimers`), so the grace
 * period must be exercised against the platform clock. Delays are kept to
 * the minimum that observes the contract (see the 30s unload test).
 */
import { test, expect, afterAll } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import { setIsPlaying, setPosition, setCurrentEpisode } from "../src/utils/audio-signals";
import { useAppStore } from "../src/stores/app";
import type { Episode } from "../src/types/episode";

// ── Sandbox (the app store reads config from XDG_CONFIG_HOME at first
//    use; set before importing the store) ─────────────────────────────────

process.env.XDG_CONFIG_HOME = join(tmpdir(), `podtui-viz-test-${process.pid}`);
process.env.XDG_DATA_HOME = join(tmpdir(), `podtui-viz-data-${process.pid}`);
process.env.PODTUI_AUDIO_BACKEND = "none";

const { useVisualizer, VISUALIZER_UNLOAD_DELAY_MS } = await import(
	"../src/stores/visualizer"
);

// ── Local chirp WAV (200Hz → 2kHz over 45s) ─────────────────────────────

const SAMPLE_RATE = 44100;
const F0 = 200;
const F1 = 2000;
const DURATION = 45;
const AMP = 30000;
const hasFfmpeg = !!Bun.which("ffmpeg");
const hasNativeLib = Bun.file(
	join(process.cwd(), "src", "native", "libcavacore.dylib"),
).exists();

async function writeChirpWav(path: string): Promise<void> {
	const total = Math.round(DURATION * SAMPLE_RATE);
	const dataSize = total * 2;
	const buf = new Uint8Array(44 + dataSize);
	const dv = new DataView(buf.buffer);
	const ascii = (off: number, s: string) => {
		for (let i = 0; i < s.length; i++) buf[off + i] = s.charCodeAt(i);
	};
	ascii(0, "RIFF");
	dv.setUint32(4, 36 + dataSize, true);
	ascii(8, "WAVE");
	ascii(12, "fmt ");
	dv.setUint32(16, 16, true);
	dv.setUint16(20, 1, true); // PCM
	dv.setUint16(22, 1, true); // mono
	dv.setUint32(24, SAMPLE_RATE, true);
	dv.setUint32(28, SAMPLE_RATE * 2, true);
	dv.setUint16(32, 2, true);
	dv.setUint16(34, 16, true);
	ascii(36, "data");
	dv.setUint32(40, dataSize, true);
	// Linear chirp: instantaneous frequency sweeps F0 → F1 over DURATION.
	const sweep = (F1 - F0) / DURATION;
	for (let i = 0; i < total; i++) {
		const t = i / SAMPLE_RATE;
		const phase = 2 * Math.PI * (F0 * t + 0.5 * sweep * t * t);
		dv.setInt16(44 + i * 2, Math.round(AMP * Math.sin(phase)), true);
	}
	await Bun.write(path, buf);
}

const wavPath = join(tmpdir(), `podtui-viz-${process.pid}-${Date.now()}.wav`);
await writeChirpWav(wavPath); // long enough to outlast the unload delay at readrate 1

// ── Helpers ─────────────────────────────────────────────────────────────

/** Poll `check` every 5ms until truthy; throw after `timeoutMs`. */
async function waitFor(
	check: () => boolean,
	timeoutMs = 10000,
): Promise<void> {
	const start = Date.now();
	while (!check()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error("condition not met in time");
		}
		await Bun.sleep(5);
	}
}

/**
 * Start playback against the local WAV and wait for the first frame.
 *
 * The reader samples the window ENDING at the playback position, so a
 * frozen position clock would serve a 1-sample window at position 0 and
 * never produce a full frame (in production mpv advances the clock every
 * poll). Drive the clock to 2s right after play — inside the 3s decode-head
 * burst — so complete windows are available immediately.
 */
async function startPlaying(): Promise<void> {
	const viz = useVisualizer();
	viz.setBarCount(64);
	viz.setFocused(true);
	setCurrentEpisode({ audioUrl: wavPath } as unknown as Episode);
	setIsPlaying(true);
	setPosition(2);
	await waitFor(() => viz.isRunning(), 10000);
	await waitFor(() => !viz.isLoading() && viz.barData().length > 0, 10000);
}

const skip = !(hasFfmpeg && hasNativeLib);

// ── Tests ────────────────────────────────────────────────────────────────

test.skipIf(skip)(
	"starts on playback: loading state first, then frequency bars",
	async () => {
		const viz = useVisualizer();
		await startPlaying();
		expect(viz.barData().length).toBe(64);
		expect(viz.isLoading()).toBe(false);
	},
	{ timeout: 20000 },
);

// Regression: with the position clock frozen at the start position (mpv
// still opening the stream), the reader samples a window ending at the
// start — a 1-sample slice it can never fill. The smooth clock must be
// seeded at pipeline start so the interpolated target advances and bars
// render as soon as ffmpeg has ANY audio, not after the first position poll.
test.skipIf(skip)(
	"renders bars while the position clock is still frozen at 0",
	async () => {
		const viz = useVisualizer();
		viz.setBarCount(64);
		viz.setFocused(true);
		setCurrentEpisode({ audioUrl: wavPath } as unknown as Episode);
		setIsPlaying(true);
		// Deliberately do NOT advance the mock position: the clock stays at 0.
		await waitFor(() => viz.isRunning(), 10000);
		await waitFor(() => !viz.isLoading() && viz.barData().length > 0, 10000);
		expect(viz.barData().length).toBe(64);
	},
	{ timeout: 20000 },
);

test.skipIf(skip)(
	"losing focus keeps the warm pipeline alive; refocus within the delay resumes without restart",
	async () => {
		const viz = useVisualizer();
		await startPlaying();

		viz.setFocused(false);
		// Not an instant teardown: observe the pipeline well inside the 30s
		// grace window.
		await Bun.sleep(500);
		expect(viz.isRunning()).toBe(true);
		expect(viz.isLoading()).toBe(false);

		// Still live: moving the position clock changes the bars (chirp →
		// different spectrum at 3s than at the 2s start position).
		setPosition(3);
		const barsBefore = viz.barData();
		await waitFor(() => viz.barData() !== barsBefore, 3000);

		// Refocus within the delay: warm pipeline, no restart — a restart
		// would respawn ffmpeg and flash the loading state. Watch for that
		// flash over a short observation window.
		viz.setFocused(true);
		let sawRestartLoading = false;
		const start = Date.now();
		while (Date.now() - start < 250) {
			if (viz.isLoading()) sawRestartLoading = true;
			await Bun.sleep(5);
		}
		expect(sawRestartLoading).toBe(false);
		expect(viz.isRunning()).toBe(true);
		expect(viz.barData().length).toBe(64);
	},
	{ timeout: 20000 },
);

// The store's unload is a real `setTimeout(VISUALIZER_UNLOAD_DELAY_MS)` with
// no injectable clock (bun 1.3.8 has no fake timers), so the grace period is
// exercised against the platform clock — this is the deliberate-exception
// case from the no-real-timers rule.
test.skipIf(skip)(
	"unloads the pipeline after the unfocused grace delay",
	async () => {
		const viz = useVisualizer();
		await startPlaying();
		expect(viz.isRunning()).toBe(true);

		viz.setFocused(false);
		await Bun.sleep(VISUALIZER_UNLOAD_DELAY_MS + 1500);

		expect(viz.isRunning()).toBe(false);
		expect(viz.isLoading()).toBe(false);
	},
	{ timeout: 45000 },
);

// Settings master switch: turning the visualizer off must tear the running
// pipeline down (not just hide the component), and re-enabling restarts it
// from the current position.
test.skipIf(skip)(
	"disabling the visualizer stops a running pipeline; re-enabling restarts it",
	async () => {
		const viz = useVisualizer();
		const app = useAppStore();
		await app.whenReady();
		await startPlaying();
		expect(viz.isRunning()).toBe(true);

		app.updateVisualizer({ enabled: false });
		await waitFor(() => !viz.isRunning(), 10000);
		expect(viz.isLoading()).toBe(false);
		// Stopping the pipeline must drop the last rendered frame — a cold
		// restart (re-enable, unload, episode change) would otherwise show
		// stale bars from the previous run and never reach the loading
		// state (the spinner only shows while bars are empty).
		expect(viz.barData().length).toBe(0);

		app.updateVisualizer({ enabled: true });
		// The restart surfaces the loading state before the first frame.
		await waitFor(() => viz.isLoading(), 5000);
		await waitFor(() => !viz.isLoading() && viz.barData().length > 0, 10000);
		expect(viz.barData().length).toBe(64);
	},
	{ timeout: 20000 },
);

// A pause followed by a seek while paused, then resume, lands OUTSIDE the
// decoded sliding window: the cache can't serve bars instantly, so the
// store must surface the warm-up as a loading state instead of silently
// holding the stale pre-pause frame. Regression: resumeVisualization never
// set isLoading, so the last frame froze with no feedback until the
// re-decode's first frame landed.
test.skipIf(skip)(
	"resume into undecoded audio shows the loading state until bars land",
	async () => {
		const viz = useVisualizer();
		await startPlaying();
		expect(viz.barData().length).toBe(64);

		// Pause, then seek far ahead while paused (outside the ~10s of
		// decoded coverage), then resume.
		setIsPlaying(false);
		await waitFor(() => !viz.isRunning(), 10000);
		setPosition(30);
		setIsPlaying(true);

		// The resume position isn't decoded yet — loading, not frozen bars.
		await waitFor(() => viz.isLoading(), 5000);
		expect(viz.isRunning()).toBe(true);

		// Playback advances past the resume point (mpv moves the clock);
		// once the re-decode covers it, fresh bars replace the stale
		// pre-pause frame (chirp spectrum at 30s ≠ 2s) and the loading
		// state clears.
		setPosition(31);
		const barsBefore = viz.barData();
		await waitFor(
			() => !viz.isLoading() && viz.barData() !== barsBefore,
			15000,
		);
		expect(viz.barData().length).toBe(64);
	},
	{ timeout: 30000 },
);

// After a long pause on a network stream, the player (mpv) re-buffers:
// `isPlaying` stays true but the position clock freezes. Without
// detection the waveform rendered the same cached window forever — static
// bars and no feedback. The render loop must report the stall as a
// loading state and clear it the moment the clock moves again.
test.skipIf(skip)(
	"a frozen position clock while playing surfaces a stall; recovery clears it",
	async () => {
		const viz = useVisualizer();
		await startPlaying();
		expect(viz.isStalled()).toBe(false);

		// Freeze the position: isPlaying stays true, the clock never moves.
		await waitFor(() => viz.isStalled(), 10000);

		// Player recovers — the clock advances again.
		setPosition(4);
		await waitFor(() => !viz.isStalled(), 3000);
		expect(viz.isRunning()).toBe(true);
	},
	{ timeout: 20000 },
);

// Resume re-arms a pipeline whose ffmpeg pass was killed at pause: the
// stale pre-pause bars must not masquerade as live data while the player
// recovers. The spinner shows IN THEIR PLACE until the position clock
// advances past the resume point — a frozen clock (mpv re-buffering after
// a long pause) keeps the spinner even though the cache can serve the
// same window.
test.skipIf(skip)(
	"resume shows the loading state in place of stale bars until the position clock advances",
	async () => {
		const viz = useVisualizer();
		await startPlaying();
		expect(viz.isLoading()).toBe(false);

		// Pause, then resume against the still-covered position.
		setIsPlaying(false);
		await waitFor(() => !viz.isRunning(), 10000);
		setIsPlaying(true);

		// The spinner replaces the bars immediately on resume.
		await waitFor(() => viz.isLoading(), 5000);
		expect(viz.isRunning()).toBe(true);

		// Position clock stays frozen at the resume point (re-buffering):
		// the loading state must persist, not yield to static cached bars.
		await Bun.sleep(250);
		expect(viz.isLoading()).toBe(true);

		// Player recovers — the clock advances → fresh bars, spinner gone.
		setPosition(3);
		await waitFor(() => !viz.isLoading(), 3000);
		expect(viz.barData().length).toBe(64);
	},
	{ timeout: 20000 },
);

// The post-resume loading gate must be "the clock MOVED from the resume
// point", not "the clock moved PAST it". Gating on `>` strands the spinner
// forever when the user seeks BACKWARD during the resume spinner (the
// classic "missed that, rewind" while a network stream re-buffers): the
// position never again exceeds the resume point, the cache serves live
// frames for the new position, and the loading state never clears.
test.skipIf(skip)(
	"backward seek during the resume loading state clears it",
	async () => {
		const viz = useVisualizer();
		await startPlaying();
		expect(viz.isLoading()).toBe(false);

		// Pause, then resume against the still-covered position: spinner.
		setIsPlaying(false);
		await waitFor(() => !viz.isRunning(), 10000);
		setIsPlaying(true);
		await waitFor(() => viz.isLoading(), 5000);

		// User seeks BACKWARD while the player re-buffers. The position is
		// inside decoded coverage, so fresh bars must replace the spinner.
		setPosition(1);
		await waitFor(() => !viz.isLoading() && viz.barData().length > 0, 3000);
		expect(viz.barData().length).toBe(64);
	},
	{ timeout: 20000 },
);

// ── Teardown ─────────────────────────────────────────────────────────────

afterAll(() => {
	// Release any pipeline still running (e.g. if a test failed midway).
	setIsPlaying(false);
});
