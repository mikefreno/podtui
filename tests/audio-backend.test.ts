/**
 * MpvBackend resident-daemon contract tests (real mpv process).
 *
 * Pins the IPC contract the app's playback depends on:
 *
 * 1. play() loads a file and position advances (observed, no polling).
 * 2. pause()/resume() flip the player-reported pause state through IPC.
 * 3. seek() lands where asked.
 * 4. stop() unloads the file but keeps the daemon alive (isAlive stays
 *    true — the daemon model's whole point: no process churn per episode).
 * 5. preload() parks an episode paused; play() of the SAME url then starts
 *    it by unpausing — the boot-restore fast path with no second load.
 * 6. EOF: the episode ends → isPlaying() goes false on its own; pressing
 *    resume() afterwards replays from the top.
 * 7. Daemon death: a killed/crashed mpv is detected (isAlive drops);
 *    resume() refuses to unpause the fresh idle daemon (throws
 *    PlayerRestartedError) and play() recovers by respawning a fresh
 *    daemon and loading the file.
 *
 * All playback runs silent (volume 0). Requires a real mpv on PATH;
 * tests skip where it is missing.
 */
import { test, expect } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import {
	MpvBackend,
	PlayerRestartedError,
} from "../src/utils/audio-player";

const SAMPLE_RATE = 22050;
const FREQ = 440;
const AMP = 20000;

/** Write a WAV file containing `seconds` of a sine at AMP amplitude. */
function writeSineWav(path: string, seconds: number): void {
	const total = Math.round(seconds * SAMPLE_RATE);
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
	dv.setUint16(20, 1, true);
	dv.setUint16(22, 1, true);
	dv.setUint32(24, SAMPLE_RATE, true);
	dv.setUint32(28, SAMPLE_RATE * 2, true);
	dv.setUint16(32, 2, true);
	dv.setUint16(34, 16, true);
	ascii(36, "data");
	dv.setUint32(40, dataSize, true);
	for (let i = 0; i < total; i++) {
		const v = Math.round(AMP * Math.sin((2 * Math.PI * FREQ * i) / SAMPLE_RATE));
		dv.setInt16(44 + i * 2, v, true);
	}
	Bun.write(path, buf);
}

/** Poll a predicate until true or the deadline expires. */
async function waitFor(
	label: string,
	pred: () => boolean | Promise<boolean>,
	timeoutMs = 8000,
): Promise<void> {
	const start = Date.now();
	for (;;) {
		if (await pred()) return;
		if (Date.now() - start > timeoutMs) {
			throw new Error(`${label}: not true within ${timeoutMs}ms`);
		}
		await Bun.sleep(50);
	}
}

const hasMpv = !!Bun.which("mpv");
const wavA = join(tmpdir(), `podtui-backend-${process.pid}-a.wav`);
const wavB = join(tmpdir(), `podtui-backend-${process.pid}-b.wav`);

function fixtureWavs(): void {
	writeSineWav(wavA, 8);
	writeSineWav(wavB, 8);
}

async function cleanup(backend: MpvBackend): Promise<void> {
	backend.dispose();
	await Bun.$`rm -f ${wavA} ${wavB}`.quiet();
}

test.skipIf(!hasMpv)(
	"play / pause / resume / seek over the resident daemon",
	async () => {
		fixtureWavs();
		const backend = new MpvBackend();
		try {
			await backend.play(wavA, { volume: 0, speed: 1, startPosition: 1 });
			expect(backend.isAlive()).toBe(true);
			expect(backend.isPlaying()).toBe(true);

			// Observed position advances without any polling from us.
			await waitFor("position advances", async () => (await backend.getPosition()) > 1.3);
			expect(await backend.getPauseState()).toBe(false);
			expect(await backend.getDuration()).toBeGreaterThan(7.5);

			// Pause: reported by the player's own state, position stalls.
			await backend.pause();
			await waitFor("paused state observed", async () => (await backend.getPauseState()) === true);
			const posAtPause = await backend.getPosition();
			await Bun.sleep(400);
			expect(Math.abs((await backend.getPosition()) - posAtPause)).toBeLessThan(0.3);

			// Resume: clock advances again.
			await backend.resume();
			await waitFor("resumed state observed", async () => (await backend.getPauseState()) === false);
			await waitFor(
				"position advances after resume",
				async () => (await backend.getPosition()) > posAtPause + 0.3,
			);

			// Seek lands where asked.
			await backend.seek(6);
			await waitFor(
				"seek observed",
				async () => Math.abs((await backend.getPosition()) - 6) < 0.5,
			);

			// Stop unloads the file — but the daemon stays resident.
			await backend.stop();
			expect(backend.isPlaying()).toBe(false);
			expect(backend.isAlive()).toBe(true);
			expect(await backend.getPosition()).toBe(0);
		} finally {
			await cleanup(backend);
		}
	},
	{ timeout: 20000 },
);

test.skipIf(!hasMpv)(
	"preload parks the episode paused; play() of the same url starts it by unpausing",
	async () => {
		fixtureWavs();
		const backend = new MpvBackend();
		try {
			await backend.preload(wavB, { volume: 0, speed: 1, startPosition: 2 });
			// Parked: paused, at the requested offset, nothing advancing.
			await waitFor(
				"preload observed paused",
				async () => (await backend.getPauseState()) === true,
			);
			const parkedPos = await backend.getPosition();
			expect(parkedPos).toBeGreaterThan(1.5);
			expect(backend.isPlaying()).toBe(false);
			await Bun.sleep(400);
			expect(Math.abs((await backend.getPosition()) - parkedPos)).toBeLessThan(0.3);

			// The boot-restore fast path: play() unpauses instead of re-loading.
			await backend.play(wavB, { volume: 0, speed: 1, startPosition: parkedPos });
			expect(backend.isPlaying()).toBe(true);
			await waitFor(
				"preload fast path plays",
				async () => (await backend.getPosition()) > parkedPos + 0.3,
			);
		} finally {
			await cleanup(backend);
		}
	},
	{ timeout: 20000 },
);

test.skipIf(!hasMpv)(
	"daemon killed mid-play: resume() rejects on the fresh idle daemon; play() recovers a new one",
	async () => {
		fixtureWavs();
		const backend = new MpvBackend();
		try {
			await backend.play(wavA, { volume: 0, speed: 1, startPosition: 0 });
			await waitFor("playing", () => backend.isPlaying());
			await waitFor(
				"position advances",
				async () => (await backend.getPosition()) > 0.5,
			);

			// Simulate a crash: SIGKILL the daemon out from under us.
			const proc = (backend as unknown as { proc: { pid: number } }).proc;
			expect(proc).toBeTruthy();
			process.kill(proc.pid, "SIGKILL");
			await waitFor("death observed", () => !backend.isAlive());

			// resume() must NOT silently no-op on the dead daemon: it
			// respawns, finds the fresh daemon idle (no file loaded), and
			// throws — the hook falls back to the full play path.
			await expect(backend.resume()).rejects.toThrow(PlayerRestartedError);

			// play() (the hook's recovery) reuses the respawned daemon and
			// plays the file — audio must actually advance again.
			await backend.play(wavA, { volume: 0, speed: 1, startPosition: 0 });
			expect(backend.isAlive()).toBe(true);
			await waitFor(
				"recovered playback advances",
				async () =>
					(await backend.getPosition()) > 0.5 && backend.isPlaying(),
			);
		} finally {
			await cleanup(backend);
		}
	},
	{ timeout: 20000 },
);

test.skipIf(!hasMpv)(
	"EOF marks playback ended; resume() then replays from the top",
	async () => {
		const wavShort = join(tmpdir(), `podtui-backend-${process.pid}-short.wav`);
		writeSineWav(wavShort, 2);
		const backend = new MpvBackend();
		try {
			await backend.play(wavShort, { volume: 0, speed: 2 });
			// 2s at 2x ends in ~1s+startup. isPlaying() must drop on its own.
			await waitFor("episode ended", async () => !backend.isPlaying());

			// Play pressed on a finished episode replays from the top.
			await backend.resume();
			await waitFor("replay started", async () => backend.isPlaying());
			await waitFor(
				"replay position near start",
				async () => (await backend.getPosition()) < 3 && backend.isPlaying(),
			);
		} finally {
			backend.dispose();
			await Bun.$`rm -f ${wavShort}`.quiet();
		}
	},
	{ timeout: 20000 },
);
