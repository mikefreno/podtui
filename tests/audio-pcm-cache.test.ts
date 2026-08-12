/**
 * EpisodePcmCache position-index contract tests.
 *
 * The visualizer's bars are served from a position-indexed PCM cache that
 * ffmpeg fills at full speed. These tests pin the observable contracts the
 * fragile paced-ring design kept breaking:
 *
 * 1. readWindow(out, at) serves the EXACT window ending at playback time
 *    `at` — position mapping is sample-precise, independent of how fast or
 *    far the decode has run.
 * 2. Reads outside decoded coverage return 0 — the renderer HOLDS the last
 *    frame. (The old reader CLAMPED to a stale buffer; re-rendering the
 *    same window decayed cava into a frozen junk pattern after pause.)
 * 3. pauseDecode kills ffmpeg but keeps the cache: resume serves bars
 *    instantly, ensureDecodeAround restarts the tail decode.
 * 4. Seeking into an undecoded region starts a new segment there WITHOUT
 *    invalidating the previously decoded coverage.
 *
 * Uses a self-generated WAV (440Hz sine, mono, 22050Hz s16le — the cache's
 * native rate) so expected samples are computed analytically with no
 * resampler tolerance.
 */
import { test, expect } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import { EpisodePcmCache } from "../src/utils/audio-pcm-cache";

const SAMPLE_RATE = 22050;
const FREQ = 440;
const AMP = 30000;

/** Write a WAV file containing `seconds` of a 440Hz sine at AMP amplitude. */
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
	dv.setUint16(20, 1, true); // PCM
	dv.setUint16(22, 1, true); // mono
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

/** Analytic sample value at a file index, matching the writer's formula. */
function expectedAt(fileIndex: number): number {
	return Math.round(AMP * Math.sin((2 * Math.PI * FREQ * fileIndex) / SAMPLE_RATE));
}

/** Block until the cache covers playback time `sec`. */
async function waitForCoverage(
	cache: EpisodePcmCache,
	sec: number,
	timeoutMs = 10000,
): Promise<void> {
	const start = Date.now();
	while (!cache.covers(sec)) {
		if (Date.now() - start > timeoutMs) {
			throw new Error(`cache did not cover ${sec}s in time`);
		}
		await Bun.sleep(25);
	}
}

/** Block until the furthest decode pass has hit stream EOF. */
async function waitForFinished(
	cache: EpisodePcmCache,
	timeoutMs = 10000,
): Promise<void> {
	const start = Date.now();
	while (!cache.decodeFinished) {
		if (Date.now() - start > timeoutMs) {
			throw new Error("decode did not finish in time");
		}
		await Bun.sleep(25);
	}
}

function tmpWav(): string {
	return join(tmpdir(), `podtui-pcm-${process.pid}-${Math.floor(Math.random() * 1e9)}.wav`);
}

const hasFfmpeg = !!Bun.which("ffmpeg");

test.skipIf(!hasFfmpeg)(
	"far-forward seek into undecoded territory restarts decode AT the target (bars recover in seconds, not minutes)",
	async () => {
		const wav = tmpWav();
		writeSineWav(wav, 60);
		const cache = new EpisodePcmCache({ url: wav });
		try {
			cache.startDecode(0);
			await waitForCoverage(cache, 1);

			// Skipping 45s ahead while the pass still crawls at 4x must restart
			// the segment at the target — waiting for the frontier to chew
			// through the skipped region is minutes of frozen bars.
			cache.ensureDecodeAround(45);
			expect(cache.decoding).toBe(true);
			expect(cache.activeDecodeBaseSec).toBe(45);
			await waitForCoverage(cache, 45.1);
		} finally {
			cache.stop();
			await Bun.$`rm -f ${wav}`.quiet();
		}
	},
	{ timeout: 20000 },
);

test.skipIf(!hasFfmpeg)(
	"small forward gap closes in place — no needless reconnect",
	async () => {
		const wav = tmpWav();
		writeSineWav(wav, 60);
		const cache = new EpisodePcmCache({ url: wav });
		try {
			cache.startDecode(0);
			await waitForCoverage(cache, 2);

			// ~5s past the running frontier: at 4x pacing this closes in ~1.5s,
			// cheaper than a reconnect — the pass must NOT restart.
			const target = cache.coverageEndSec + 5;
			cache.ensureDecodeAround(target);
			expect(cache.activeDecodeBaseSec).toBe(0);
			await waitForCoverage(cache, target);
		} finally {
			cache.stop();
			await Bun.$`rm -f ${wav}`.quiet();
		}
	},
	{ timeout: 20000 },
);
const FIVE_SEC_BASE = 5 * SAMPLE_RATE; // decode offset for position-mapping tests

test.skipIf(!hasFfmpeg)(
	"readWindow serves the exact window ending at the requested position",
	async () => {
		const wav = tmpWav();
		writeSineWav(wav, 30);
		const cache = new EpisodePcmCache({ url: wav });
		try {
			cache.startDecode(5);
			await waitForCoverage(cache, 6.5);

			const out = new Float64Array(512);
			expect(cache.readWindow(out, 5.1)).toBe(512);
			// Window ENDS at the target: out[i] is the sample at
			// round(5.1*SR) - (len-1) + i (5s offset + 0.1s).
			const endIdx = Math.round(5.1 * SAMPLE_RATE);
			for (let i = 0; i < 512; i++) {
				const idx = endIdx - (out.length - 1) + i;
				expect(Math.abs(out[i] - expectedAt(idx))).toBeLessThanOrEqual(1);
			}

			// A 5ms later window is the same stream shifted by exactly
			// round(0.005*SR)=110 samples — pins position mapping precision.
			const later = new Float64Array(512);
			expect(cache.readWindow(later, 5.105)).toBe(512);
			for (let i = 0; i <= 512 - 111; i++) {
				expect(later[i]).toBe(out[i + 110]);
			}
		} finally {
			cache.stop();
			await Bun.$`rm -f ${wav}`.quiet();
		}
	},
);

test.skipIf(!hasFfmpeg)(
	"reads outside decoded coverage return 0 (renderer holds last frame, never stale junk)",
	async () => {
		const wav = tmpWav();
		writeSineWav(wav, 30);
		const cache = new EpisodePcmCache({ url: wav });
		try {
			cache.startDecode(5);
			await waitForCoverage(cache, 5.5);

			const out = new Float64Array(512);
			out.fill(-999);

			// Beyond the decode frontier.
			expect(cache.readWindow(out, 999)).toBe(0);
			// Before the segment base (decode started at 5s).
			expect(cache.readWindow(out, 4.0)).toBe(0);
			// Buffer untouched — no partial/stale samples leak through.
			for (let i = 0; i < 16; i++) expect(out[i]).toBe(-999);
		} finally {
			cache.stop();
			await Bun.$`rm -f ${wav}`.quiet();
		}
	},
);

test.skipIf(!hasFfmpeg)(
	"pauseDecode keeps the cache: resume serves instantly, tail decode continues",
	async () => {
		const wav = tmpWav();
		writeSineWav(wav, 12); // short: full tail decode lands well under a second
		const cache = new EpisodePcmCache({ url: wav });
		try {
			cache.startDecode(0);
			await waitForCoverage(cache, 1.5);

			// Pause: decode dies, cache must survive.
			cache.pauseDecode();
			expect(cache.decoding).toBe(false);
			expect(cache.covers(1)).toBe(true);

			// Serve from cache immediately after pause — this is the resume
			// fast path: zero ffmpeg cold start.
			const out = new Float64Array(512);
			expect(cache.readWindow(out, 1.0)).toBe(512);
			const endIdx = Math.round(1.0 * SAMPLE_RATE);
			for (let i = 0; i < 512; i++) {
				const idx = endIdx - (out.length - 1) + i;
				expect(Math.abs(out[i] - expectedAt(idx))).toBeLessThanOrEqual(1);
			}

			// Resume: tail decode restarts and eventually covers the file.
			cache.ensureDecodeAround(1.0);
			await waitForFinished(cache);
			expect(cache.coverageEndSec).toBeGreaterThanOrEqual(11.9);
			expect(cache.readWindow(out, 11.5)).toBe(512);
		} finally {
			cache.stop();
			await Bun.$`rm -f ${wav}`.quiet();
		}
	},
	{ timeout: 20000 },
);

test.skipIf(!hasFfmpeg)(
	"seek into an undecoded region starts a new segment without losing earlier coverage",
	async () => {
		const wav = tmpWav();
		writeSineWav(wav, 30);
		const cache = new EpisodePcmCache({ url: wav });
		try {
			// Decoded the back half only...
			cache.startDecode(10);
			await waitForCoverage(cache, 11);
			expect(cache.covers(2)).toBe(false);

			// ...then the user seeks to 2s: a new segment decodes the front,
			// and the back-half coverage stays valid throughout.
			cache.ensureDecodeAround(2);
			await waitForCoverage(cache, 2.2);
			expect(cache.covers(10.5)).toBe(true);

			const out = new Float64Array(512);
			expect(cache.readWindow(out, 10.5)).toBe(512);
			const endIdx = Math.round(10.5 * SAMPLE_RATE);
			for (let i = 0; i < 512; i++) {
				const idx = endIdx - (out.length - 1) + i;
				expect(Math.abs(out[i] - expectedAt(idx))).toBeLessThanOrEqual(1);
			}
		} finally {
			cache.stop();
			await Bun.$`rm -f ${wav}`.quiet();
		}
	},
	{ timeout: 20000 },
);
