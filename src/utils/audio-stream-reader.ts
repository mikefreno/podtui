/**
 * Real-time audio stream reader for visualization.
 *
 * Spawns a separate ffmpeg process that decodes the same audio URL
 * the player is using and outputs raw PCM data (signed 16-bit LE, mono,
 * 44100 Hz) to a pipe. The reader accumulates samples in a ring buffer
 * and serves windows *at a requested playback position* to the caller.
 *
 * This is independent from the actual playback backend — it's a
 * read-only "tap" on the audio for FFT analysis purposes. Because it is a
 * separate decoder, sync with the player is maintained by pacing decode at
 * the player's clock rate (`-readrate <speed>`) and sampling the window at
 * the position the player reports, never at the decode head.
 */

/** PCM output format constants */
const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BYTES_PER_SAMPLE = 2; // s16le

/**
 * How many samples to buffer (~10 seconds).
 * Large enough to absorb the gap between mpv's startup latency (0.5–3s,
 * more for network streams at speed) and the reader's decode head, plus
 * short player stalls. Samples older than the ring window are never needed
 * again — the renderer only samples at the current playback position.
 */
const RING_BUFFER_SAMPLES = SAMPLE_RATE * 10;

export interface AudioStreamReaderOptions {
	/** Audio URL or file path to decode */
	url: string;
	/** Sample rate (default: 44100) */
	sampleRate?: number;
}

/**
 * Monotonically increasing generation counter.
 * Each start() increments this; the read loop checks it to know
 * if it's been superseded and should bail out.
 */
let globalGeneration = 0;

import type { Subprocess } from "bun";

export class AudioStreamReader {
	private proc: Subprocess | null = null;
	private ringBuffer: Float64Array;
	private writePos = 0;
	private totalSamplesWritten = 0;
	private startPosition = 0;
	private _running = false;
	private generation = 0;
	readonly url: string;
	private sampleRate: number;

	constructor(options: AudioStreamReaderOptions) {
		this.url = options.url;
		this.sampleRate = options.sampleRate ?? SAMPLE_RATE;
		this.ringBuffer = new Float64Array(RING_BUFFER_SAMPLES);
	}

	/** Whether the reader is actively reading samples. */
	get running(): boolean {
		return this._running;
	}

	/** Total number of samples written since start(). */
	get samplesWritten(): number {
		return this.totalSamplesWritten;
	}

	/**
	 * Start the ffmpeg decode process and begin reading PCM data.
	 *
	 * If already running, the previous process is killed first.
	 * Uses a generation counter to guarantee that only one read loop
	 * is ever active — stale loops from killed processes bail out
	 * immediately.
	 *
	 * @param startPosition Seek position in seconds (default: 0).
	 * @param speed Playback speed multiplier (default: 1). Applies ffmpeg
	 *              atempo filter so visualization stays in sync with audio.
	 */
	start(startPosition = 0, speed = 1): void {
		// Always kill the previous process first — no early return on _running
		this.killProcess();

		if (!Bun.which("ffmpeg")) {
			throw new Error("ffmpeg not found — required for audio visualization");
		}

		// Increment generation so any lingering read loop from a previous
		// start() will see a mismatch and exit.
		this.generation = ++globalGeneration;
		this.startPosition = Math.max(0, startPosition);

		const readRate = Math.max(0.25, speed > 0 ? speed : 1);

		const args = [
			"ffmpeg",
			"-loglevel",
			"quiet",
			// Pace input at the player's advance rate (speed× native) rather
			// than native rate. Decoding slower than the player makes the
			// decoded position fall behind the playback position linearly
			// (bars drift away at (speed-1)s per second); decoding unthrottled
			// fills the ring with audio seconds ahead of the player (laggy
			// bars) and hits EOF early (bars freeze). `-readrate speed` keeps
			// the decode head just ahead of the position the renderer samples,
			// tracking the player clock with only mpv's startup latency as a
			// constant offset — absorbed by the ring buffer.
			"-readrate",
			String(readRate),
		];

		// `-reconnect*` are http-protocol options: ffmpeg rejects them at
		// input-open when the input is a local file, killing the process
		// before any PCM is produced. Only pass them for network URLs.
		if (/^https?:\/\//i.test(this.url)) {
			args.push(
				"-reconnect",
				"1",
				"-reconnect_streamed",
				"1",
				"-reconnect_delay_max",
				"5",
			);
		}

		// Seek before input for network efficiency
		if (startPosition > 0) {
			args.push("-ss", String(startPosition));
		}

		args.push("-i", this.url);

		// No atempo filter: the renderer samples the *source* audio at the
		// player's current position, so output samples map 1:1 to input time
		// (stream index = (targetSeconds - startPosition) * sampleRate).
		args.push(
			"-ac",
			String(CHANNELS),
			"-ar",
			String(this.sampleRate),
			"-f",
			"s16le",
			"-acodec",
			"pcm_s16le",
			"-",
		);

		this.proc = Bun.spawn(args, {
			stdout: "pipe",
			stderr: "ignore",
			stdin: "ignore",
		});

		this._running = true;
		this.writePos = 0;
		this.totalSamplesWritten = 0;

		const myGeneration = this.generation;

		this.readLoop(myGeneration);

		// Detect process exit
		this.proc.exited
			.then(() => {
				// Only clear _running if this is still the current generation
				if (this.generation === myGeneration) {
					this._running = false;
				}
			})
			.catch(() => {
				if (this.generation === myGeneration) {
					this._running = false;
				}
			});
	}

	/**
	 * Read the visualization window ending at `targetSeconds` of playback.
	 *
	 * The player (mpv) and this decoder are independent processes, so the
	 * decode head and the actual playback position drift apart (startup skew,
	 * stalls, speed changes). Instead of sampling the decode head, we select
	 * the window *at* the position the player reports, clamped to the nearest
	 * available samples when the target hasn't been decoded yet (decode head
	 * behind) or has already wrapped out of the ring (long stall).
	 *
	 * @param out - Float64Array to fill with samples (scaled ~+/-32768 for cavacore).
	 * @param targetSeconds - Playback position (input seconds) to sample.
	 * @returns Number of samples written to `out`.
	 */
	read(out: Float64Array, targetSeconds: number): number {
		if (this.totalSamplesWritten <= 0 || out.length === 0) return 0;

		const headSample = this.totalSamplesWritten - 1;
		const coveredStart = Math.max(
			0,
			this.totalSamplesWritten - this.ringBuffer.length,
		);

		const targetSample = Math.max(
			0,
			Math.round((targetSeconds - this.startPosition) * this.sampleRate),
		);

		// Window end: the target, clamped to what's been decoded so far.
		const endSample = Math.min(targetSample, headSample);
		// Window start: at most out.length samples back, clamped to what the
		// ring still holds (target older than the ring -> serve the oldest
		// available window, which is the closest to the target).
		const startSample = Math.max(
			coveredStart,
			Math.min(endSample, endSample - out.length + 1),
		);
		const available = endSample - startSample + 1;
		if (available <= 0) return 0;

		const ringLen = this.ringBuffer.length;
		for (let i = 0; i < available; i++) {
			out[i] = this.ringBuffer[(startSample + i) % ringLen];
		}

		return available;
	}

	/**
	 * Stop the ffmpeg process and clean up.
	 * Safe to call multiple times. Guarantees the read loop exits.
	 */
	stop(): void {
		// Bump generation to invalidate any running read loop
		this.generation = ++globalGeneration;
		this._running = false;
		this.killProcess();
		this.writePos = 0;
		this.totalSamplesWritten = 0;
	}

	/**
	 * Restart the reader at a new position and/or speed.
	 */
	restart(startPosition = 0, speed = 1): void {
		this.start(startPosition, speed);
	}

	/** Kill the ffmpeg process without touching generation/state. */
	private killProcess(): void {
		if (this.proc) {
			try {
				this.proc.kill();
			} catch {
				/* ignore */
			}
			this.proc = null;
		}
	}

	/** Internal: continuously reads stdout from ffmpeg and fills the ring buffer. */
	private async readLoop(myGeneration: number): Promise<void> {
		const stdout = this.proc?.stdout;
		if (!stdout || typeof stdout === "number") return;

		const reader = (stdout as ReadableStream<Uint8Array>).getReader();
		try {
			while (this.generation === myGeneration) {
				const { done, value } = await reader.read();
				if (done || this.generation !== myGeneration) break;
				if (!value || value.byteLength === 0) continue;

				const sampleCount = Math.floor(value.byteLength / BYTES_PER_SAMPLE);
				if (sampleCount === 0) continue;

				const int16View = new Int16Array(
					value.buffer,
					value.byteOffset,
					sampleCount,
				);

				for (let i = 0; i < sampleCount; i++) {
					this.ringBuffer[this.writePos] = int16View[i];
					this.writePos = (this.writePos + 1) % this.ringBuffer.length;
					this.totalSamplesWritten++;
				}
			}
		} catch {
			// Stream ended or process killed — expected during stop()
		} finally {
			try {
				reader.releaseLock();
			} catch {
				/* ignore */
			}
		}
	}
}
