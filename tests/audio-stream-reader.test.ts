/**
 * AudioStreamReader sync contract tests.
 *
 * The visualizer's bars must track the player's position in real time even
 * though the reader is an independent ffmpeg process. These tests pin the
 * two mechanisms that make that true:
 *
 * 1. `read(out, target)` serves the FFT window *at* the requested playback
 *    position — not at the decode head, which drifts from the player
 *    (startup skew, stalls).
 * 2. Decode is paced at the player's clock rate (`-readrate <speed>`), so
 *    the decode head keeps up with the position at any playback speed —
 *    native-rate pacing falls behind by (speed-1)s per second.
 *
 * Uses a self-generated WAV (440Hz sine, mono, 44.1kHz s16le) so the
 * expected samples can be computed analytically and compared exactly.
 */
import { test, expect } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import { AudioStreamReader } from "../src/utils/audio-stream-reader";

const SAMPLE_RATE = 44100;
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

/**
 * Block until the reader's decode head has advanced past `samples` samples.
 * The head advances at readrate × real time, so this bounds how long we wait.
 */
async function waitForHead(
	reader: AudioStreamReader,
	samples: number,
	timeoutMs = 8000,
): Promise<void> {
	const start = Date.now();
	while (reader.samplesWritten < samples) {
		if (Date.now() - start > timeoutMs) {
			throw new Error("reader decode head did not advance in time");
		}
		await Bun.sleep(25);
	}
}

const hasFfmpeg = !!Bun.which("ffmpeg");

test.skipIf(!hasFfmpeg)(
	"read() serves the exact window at the requested position",
	async () => {
		const wav = join(tmpdir(), `podtui-reader-${process.pid}-${Date.now()}.wav`);
		writeSineWav(wav, 20);
		const reader = new AudioStreamReader({ url: wav });
		try {
			reader.start(5, 1);
			// Cover targets up to ~5.6s (head must pass the read target).
			await waitForHead(reader, Math.round(0.6 * SAMPLE_RATE));

			const out = new Float64Array(512);

			// Window at 5.1s: the window ENDS at the target, so out[i] is at
			// file index 5*SR + round((5.1-5)*SR) - (len-1) + i.
			expect(reader.read(out, 5.1)).toBe(512);
			for (let i = 0; i < 512; i++) {
				const idx =
					Math.round(5 * SAMPLE_RATE) +
					Math.round((5.1 - 5) * SAMPLE_RATE) -
					(out.length - 1) +
					i;
				expect(Math.abs(out[i] - expectedAt(idx))).toBeLessThanOrEqual(1);
			}

			// Window at 5.105s is the same stream shifted by exactly
			// round(0.005*SR)=221 samples — pins that the target maps to a
			// precise offset, not "whatever the decode head is at".
			const later = new Float64Array(512);
			expect(reader.read(later, 5.105)).toBe(512);
			for (let i = 0; i <= 512 - 222; i++) {
				expect(later[i]).toBe(out[i + 221]);
			}
		} finally {
			reader.stop();
			await Bun.$`rm -f ${wav}`.quiet();
		}
	},
);

test.skipIf(!hasFfmpeg)(
	"decode keeps up with the player clock at 2x speed",
	async () => {
		const wav = join(tmpdir(), `podtui-reader-${process.pid}-${Date.now()}.wav`);
		writeSineWav(wav, 20);
		const reader = new AudioStreamReader({ url: wav });
		try {
			reader.start(0, 2);
			// At 2x pacing the head reaches 2.5s after ~1.25s of wall time.
			// With native-rate pacing it would only be at ~1.25s, and the
			// window at 2.5s would clamp to the head — content mismatch.
			await waitForHead(reader, Math.round(2.5 * SAMPLE_RATE));

			const out = new Float64Array(512);
			expect(reader.read(out, 2.5)).toBe(512);
			for (let i = 0; i < 512; i++) {
				const idx =
					Math.round(2.5 * SAMPLE_RATE) - (out.length - 1) + i;
				expect(Math.abs(out[i] - expectedAt(idx))).toBeLessThanOrEqual(1);
			}
		} finally {
			reader.stop();
			await Bun.$`rm -f ${wav}`.quiet();
		}
	},
);

test.skipIf(!hasFfmpeg)(
	"read() clamps to the nearest samples when the target is beyond the head",
	async () => {
		const wav = join(tmpdir(), `podtui-reader-${process.pid}-${Date.now()}.wav`);
		writeSineWav(wav, 20);
		const reader = new AudioStreamReader({ url: wav });
		try {
			reader.start(0, 1);
			await waitForHead(reader, Math.round(0.3 * SAMPLE_RATE));

			// Target far beyond the decode head: serve the newest available
			// window (real sine samples, never zeros or garbage).
			const out = new Float64Array(512);
			expect(reader.read(out, 999)).toBe(512);
			const maxAbs = Math.max(...Array.from(out, Math.abs));
			expect(maxAbs).toBeGreaterThan(10000);
			for (const v of out) {
				expect(Math.abs(v)).toBeLessThanOrEqual(AMP + 1);
			}
		} finally {
			reader.stop();
			await Bun.$`rm -f ${wav}`.quiet();
		}
	},
);
