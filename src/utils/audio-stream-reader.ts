/**
 * Real-time audio stream reader for visualization.
 *
 * Spawns a separate ffmpeg process that decodes the same audio URL
 * the player is using and outputs raw PCM data (signed 16-bit LE, mono,
 * 44100 Hz) to a pipe. The reader accumulates samples in a ring buffer
 * and provides them to the caller on demand.
 *
 * This is independent from the actual playback backend — it's a
 * read-only "tap" on the audio for FFT analysis purposes.
 */

/** PCM output format constants */
const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BYTES_PER_SAMPLE = 2; // s16le

/** How many samples to buffer (~1 second) */
const RING_BUFFER_SAMPLES = SAMPLE_RATE;

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

export class AudioStreamReader {
	private proc: ReturnType<typeof Bun.spawn> | null = null;
	private ringBuffer: Float64Array;
	private writePos = 0;
	private totalSamplesWritten = 0;
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

		const args = [
			"ffmpeg",
			"-loglevel",
			"quiet",
			// Read input at native frame rate so decoded PCM stays in sync with
			// real-time playback. Without -re, ffmpeg greedily decodes the whole
			// file as fast as possible: the ring buffer fills with audio seconds
			// ahead of the player (laggy bars), then the process exits when it
			// hits EOF (bars freeze ~10s in).
			"-re",
			"-reconnect",
			"1",
			"-reconnect_streamed",
			"1",
			"-reconnect_delay_max",
			"5",
		];

		// Seek before input for network efficiency
		if (startPosition > 0) {
			args.push("-ss", String(startPosition));
		}

		args.push("-i", this.url);

		// Apply speed via atempo filter if not 1x.
		// ffmpeg atempo only supports 0.5–100.0; chain multiple for extremes.
		if (speed !== 1 && speed > 0) {
			args.push("-af", buildAtempoChain(speed));
		}

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
	 * Read available samples into the provided buffer.
	 * Returns the number of samples actually copied.
	 *
	 * @param out - Float64Array to fill with samples (scaled ~+/-32768 for cavacore).
	 * @returns Number of samples written to `out`.
	 */
	read(out: Float64Array): number {
		const available = Math.min(
			out.length,
			this.totalSamplesWritten,
			this.ringBuffer.length,
		);
		if (available <= 0) return 0;

		// Read the most recent `available` samples from the ring buffer
		const readStart =
			(this.writePos - available + this.ringBuffer.length) %
			this.ringBuffer.length;

		if (readStart + available <= this.ringBuffer.length) {
			out.set(this.ringBuffer.subarray(readStart, readStart + available));
		} else {
			const firstChunk = this.ringBuffer.length - readStart;
			out.set(this.ringBuffer.subarray(readStart, this.ringBuffer.length));
			out.set(this.ringBuffer.subarray(0, available - firstChunk), firstChunk);
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

/**
 * Build an ffmpeg atempo filter chain for a given speed.
 * atempo only accepts values in [0.5, 100.0], so we chain
 * multiple filters for extreme values (e.g. 0.25 = atempo=0.5,atempo=0.5).
 */
function buildAtempoChain(speed: number): string {
	const parts: string[] = [];
	let remaining = Math.max(0.25, Math.min(4, speed));

	while (remaining > 100) {
		parts.push("atempo=100.0");
		remaining /= 100;
	}
	while (remaining < 0.5) {
		parts.push("atempo=0.5");
		remaining /= 0.5;
	}
	parts.push(`atempo=${remaining}`);

	return parts.join(",");
}
