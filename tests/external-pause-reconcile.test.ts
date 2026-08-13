/**
 * external-pause-reconcile.test.ts — "audio paused outside PodTUI must not
 * freeze the player tab" regression test.
 *
 * The OS can pause the player without PodTUI knowing: system sleep/lock,
 * AirPod removal / device swap, OS media keys, the Now Playing center. mpv
 * flips its own `pause` property and keeps it there. Before the fix,
 * useAudio's signals stayed on "playing" — [Pause] button shown while
 * silent, a poll that only re-read the same frozen `time-pos` (stuck
 * waveform), and no way to catch an external RESUME either (the poll was
 * stopped whenever the UI thought it was paused).
 *
 * Integration style (like restore-session.test.ts): real stores and real
 * persistence files in a temp XDG_CONFIG_HOME — but with the REAL mpv
 * backend driven over its actual IPC socket. The test flips mpv's pause
 * property the same way the OS does and asserts useAudio reconciles in
 * both directions. Skipped when mpv isn't installed.
 *
 * Also covers daemon crash recovery: killing mpv out from under the app
 * must drop the UI out of "playing" (finalizeTrackEnd), and the next Play
 * press must respawn a fresh daemon and resume audio from the saved
 * position — the play button may never silently no-op on a dead player.
 *
 * Real-timer note: the reconcile path runs on useAudio's real 150ms poll
 * interval against a real mpv process, with no injectable clock — the
 * deliberate-exception case from the no-real-timers rule (same as
 * visualizer-store.test.ts). `waitFor` polls with Bun.sleep.
 *
 * Shared-worker note (same as restore-session.test.ts): the suite reuses
 * bun test workers, so other files' `mock.module("../src/hooks/useAudio")`
 * leaks into this file's module registry. The REAL useAudio is therefore
 * imported via a `?external-pause-test` query suffix — a distinct module
 * identity bun loads from disk, bypassing the leaked mock.
 */
import { test, expect, afterAll } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	writeFileSync,
	rmSync,
	readdirSync,
	statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const hasMpv = !!Bun.which("mpv");

// ── Sandbox BEFORE any app module evaluates (mirrors restore-session) ────
const CONFIG = mkdtempSync(join(tmpdir(), "podtui-extpause-"));
process.env.XDG_CONFIG_HOME = CONFIG;
process.env.XDG_DATA_HOME = mkdtempSync(join(tmpdir(), "podtui-extpause-data-"));
process.env.PODTUI_AUDIO_BACKEND = "mpv"; // real backend; the test drives mpv's IPC
const APP_CONFIG = join(CONFIG, "podtui");
mkdirSync(APP_CONFIG, { recursive: true });

// Seed one feed so the app store boots cleanly. No coverUrl — the play()
// path skips cover-art fetching. The RSS URL is unreachable so the
// background refresh fails fast and leaves the seeded data untouched.
const ISO = "2026-08-10T00:00:00.000Z";
const feed = {
	id: "feed1",
	podcast: {
		id: "pod1",
		title: "Pod One",
		description: "",
		feedUrl: "http://127.0.0.1:1/show.xml",
		lastUpdated: ISO,
		isSubscribed: true,
	},
	episodes: [],
	visibility: "public",
	sourceId: "test",
	lastUpdated: ISO,
	isPinned: false,
};

await Bun.write(
	join(APP_CONFIG, "config.json"),
	JSON.stringify({ feeds: [feed] }, null, 2),
);

// ── Local 60s WAV so playback is hermetic (no network, no early EOF) ─────
const wavPath = join(tmpdir(), `podtui-extpause-${process.pid}.wav`);
{
	const SAMPLE_RATE = 44100;
	const DURATION = 60;
	const dataLen = SAMPLE_RATE * DURATION; // mono 16-bit
	const buf = Buffer.alloc(44 + dataLen * 2);
	buf.write("RIFF", 0);
	buf.writeUInt32LE(36 + dataLen * 2, 4);
	buf.write("WAVE", 8);
	buf.write("fmt ", 12);
	buf.writeUInt32LE(16, 16); // fmt chunk size
	buf.writeUInt16LE(1, 20); // PCM
	buf.writeUInt16LE(1, 22); // mono
	buf.writeUInt32LE(SAMPLE_RATE, 24);
	buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
	buf.writeUInt16LE(2, 32); // block align
	buf.writeUInt16LE(16, 34); // bits per sample
	buf.write("data", 36);
	buf.writeUInt32LE(dataLen * 2, 40);
	for (let i = 0; i < dataLen; i++) {
		const sample = Math.round(
			Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 8000,
		);
		buf.writeInt16LE(sample, 44 + i * 2);
	}
	writeFileSync(wavPath, buf);
}

// ── Real modules (loaded after env + sandbox are set up) ──────────────────
// @ts-expect-error — bun-only query suffix: distinct module identity that
// loads the real file instead of a leaked mock.module from another test file.
const { useAudio } = await import("../src/hooks/useAudio?external-pause-test");

/**
 * The socket path of the LIVE backend daemon in this process. The backend
 * names sockets per-instance (`podtui-mpv-<pid>-<instance>.sock`), so scan
 * tmpdir for this pid's sockets and take the newest (the one mpv actually
 * bound — earlier instances may have been orphaned by a re-spawn).
 */
function mpvSocket(): string | null {
	let newest: string | null = null;
	let newestMtime = 0;
	for (const name of readdirSync(tmpdir())) {
		if (
			!name.startsWith(`podtui-mpv-${process.pid}-`) ||
			!name.endsWith(".sock")
		) {
			continue;
		}
		const candidate = join(tmpdir(), name);
		const mtime = statSync(candidate).mtimeMs;
		if (mtime > newestMtime) {
			newest = candidate;
			newestMtime = mtime;
		}
	}
	return newest;
}

/**
 * Send a raw mpv IPC command over the unix socket — exactly how the OS
 * media session pauses/resumes mpv without PodTUI's involvement.
 */
async function mpvCommand(command: unknown[]): Promise<void> {
	const socket = mpvSocket();
	if (!socket) throw new Error("backend mpv socket not found");
	const { promise, resolve, reject } = Promise.withResolvers<void>();
	let settled = false;
	const settle = (err: Error | null): void => {
		if (settled) return;
		settled = true;
		if (err) reject(err);
		else resolve();
	};
	Bun.connect({
		unix: socket,
		socket: {
			open(s) {
				s.write(JSON.stringify({ command }) + "\n");
			},
			data() {},
			error() {
				settle(new Error("mpv IPC connect failed"));
			},
			close() {
				settle(null);
			},
		},
	}).then((s) =>
		setTimeout(() => {
			try {
				s.end();
			} catch {}
		}, 150),
	);
	// Never hang the test on a vanished socket.
	setTimeout(() => settle(null), 1000);
	await promise;
}

/** Poll `check` every 25ms until truthy; throw after `timeoutMs`. */
async function waitFor(
	check: () => boolean,
	timeoutMs = 10000,
): Promise<void> {
	const start = Date.now();
	while (!check()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error("condition not met in time");
		}
		await Bun.sleep(25);
	}
}

/** SIGKILL the backend's mpv daemon — a crash/kill out from under the app.
 *  The mpv command line carries the IPC socket path, so pgrep finds it by
 *  that (the socket name is unique to this test process). */
async function killMpvDaemon(): Promise<void> {
	const socket = mpvSocket();
	if (!socket) throw new Error("backend mpv socket not found");
	const pids = (await Bun.$`pgrep -f ${socket}`.quiet().text())
		.split("\n")
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
		.map(Number);
	expect(pids.length).toBeGreaterThan(0);
	for (const pid of pids) {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			/* already gone */
		}
	}
}

const episode = {
	id: "ep1",
	podcastId: "pod1",
	title: "Episode One",
	description: "desc",
	audioUrl: wavPath,
	duration: 60,
	pubDate: new Date(),
};

// ── Tests ────────────────────────────────────────────────────────────────

test.skipIf(!hasMpv)(
	"external pause flips the UI to paused; external resume recovers",
	async () => {
		const audio = useAudio();
		await audio.play(episode);
		expect(audio.isPlaying()).toBe(true);

		// Simulate the OS pausing the session (lock/sleep, AirPod removal,
		// device swap, media-center pause): flip mpv's own pause property
		// over IPC. PodTUI is never told.
		await mpvCommand(["set_property", "pause", true]);
		await waitFor(() => !audio.isPlaying());
		expect(audio.isPlaying()).toBe(false);
		// The episode stays loaded — nothing was torn down.
		expect(audio.currentEpisode()?.id).toBe("ep1");

		// Simulate an external resume (AirPod play tap, media-center play).
		await mpvCommand(["set_property", "pause", false]);
		await waitFor(() => audio.isPlaying());
		expect(audio.isPlaying()).toBe(true);

		// The TUI transport still works from the reconciled state.
		await audio.togglePlayback();
		expect(audio.isPlaying()).toBe(false);
		await audio.togglePlayback();
		expect(audio.isPlaying()).toBe(true);

		await audio.stop();
		expect(audio.isPlaying()).toBe(false);
	},
	{ timeout: 30000 },
);

test.skipIf(!hasMpv)(
	"mpv killed mid-play: UI drops out of playing; pressing play recovers a fresh daemon",
	async () => {
		const audio = useAudio();
		await audio.play(episode);
		// Instant assertion: play() sets isPlaying synchronously when it
		// succeeded. (In a shared worker that leaked a store mock from
		// another test file, play() fails and this catches it at 0ms
		// instead of burning the waitFor timeout below.)
		expect(audio.isPlaying()).toBe(true);
		// Let the clock advance past the 5s progress-save floor so recovery
		// has a saved position to resume from (positions <5s are not stored).
		await waitFor(() => audio.position() > 6);
		const crashPos = audio.position();

		// Crash the player out from under the app.
		await killMpvDaemon();
		await waitFor(() => !audio.isPlaying());
		expect(audio.isPlaying()).toBe(false);
		// The episode stays current — recovery can restart it.
		expect(audio.currentEpisode()?.id).toBe("ep1");

		// Press play: must respawn mpv and resume from the saved position —
		// not silently flip the UI to "playing" with no process behind it.
		await audio.togglePlayback();
		expect(audio.isPlaying()).toBe(true);
		expect(audio.position()).toBeGreaterThanOrEqual(crashPos - 0.5);
		// Audio actually advances again — proof a fresh daemon is playing.
		await waitFor(() => audio.position() > crashPos + 0.5);

		await audio.stop();
		expect(audio.isPlaying()).toBe(false);
	},
	{ timeout: 30000 },
);

// ── Teardown ──────────────────────────────────────────────────────────────

afterAll(async () => {
	try {
		useAudio().stop();
	} catch {
		/* best-effort */
	}
	// The resident daemon survives stop() by design — quit it so test
	// workers don't leak idle mpv processes.
	try {
		await mpvCommand(["quit"]);
	} catch {
		/* best-effort */
	}
	try {
		const socket = mpvSocket();
		if (socket) rmSync(socket, { force: true });
	} catch {
		/* best-effort */
	}
	try {
		rmSync(wavPath, { force: true });
	} catch {
		/* best-effort */
	}
});
