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
const SAMPLE_RATE = 44100
const CHANNELS = 1
const BYTES_PER_SAMPLE = 2 // s16le

/** How many samples to buffer (≈1 second) */
const RING_BUFFER_SAMPLES = SAMPLE_RATE

export interface AudioStreamReaderOptions {
  /** Audio URL or file path to decode */
  url: string
  /** Start position in seconds (for seeking sync) */
  startPosition?: number
  /** Sample rate (default: 44100) */
  sampleRate?: number
}

export class AudioStreamReader {
  private proc: ReturnType<typeof Bun.spawn> | null = null
  private ringBuffer: Float64Array
  private writePos = 0
  private totalSamplesWritten = 0
  private _running = false
  private readPromise: Promise<void> | null = null
  private url: string
  private sampleRate: number

  constructor(options: AudioStreamReaderOptions) {
    this.url = options.url
    this.sampleRate = options.sampleRate ?? SAMPLE_RATE
    this.ringBuffer = new Float64Array(RING_BUFFER_SAMPLES)
  }

  /** Whether the reader is actively reading samples. */
  get running(): boolean {
    return this._running
  }

  /** Total number of samples written since start(). */
  get samplesWritten(): number {
    return this.totalSamplesWritten
  }

  /**
   * Start the ffmpeg decode process and begin reading PCM data.
   * @param startPosition Seek position in seconds (default: 0).
   */
  start(startPosition = 0): void {
    if (this._running) return
    if (!Bun.which("ffmpeg")) {
      throw new Error("ffmpeg not found — required for audio visualization")
    }

    const args = [
      "ffmpeg",
      "-loglevel", "quiet",
    ]

    // Seek before input for network efficiency
    if (startPosition > 0) {
      args.push("-ss", String(startPosition))
    }

    args.push(
      "-i", this.url,
      "-ac", String(CHANNELS),
      "-ar", String(this.sampleRate),
      "-f", "s16le",       // raw signed 16-bit little-endian PCM
      "-acodec", "pcm_s16le",
      "-",                 // output to stdout
    )

    this.proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "ignore",
      stdin: "ignore",
    })

    this._running = true
    this.writePos = 0
    this.totalSamplesWritten = 0

    // Start async reading loop
    this.readPromise = this.readLoop()

    // Detect process exit
    this.proc.exited.then(() => {
      this._running = false
    }).catch(() => {
      this._running = false
    })
  }

  /**
   * Read available samples into the provided buffer.
   * Returns the number of samples actually copied.
   *
   * @param out - Float64Array to fill with samples (scaled ~±32768 for cavacore).
   * @returns Number of samples written to `out`.
   */
  read(out: Float64Array): number {
    const available = Math.min(out.length, this.totalSamplesWritten, this.ringBuffer.length)
    if (available <= 0) return 0

    // Read the most recent `available` samples from the ring buffer
    const readStart = (this.writePos - available + this.ringBuffer.length) % this.ringBuffer.length

    if (readStart + available <= this.ringBuffer.length) {
      // Contiguous read
      out.set(this.ringBuffer.subarray(readStart, readStart + available))
    } else {
      // Wraps around
      const firstChunk = this.ringBuffer.length - readStart
      out.set(this.ringBuffer.subarray(readStart, this.ringBuffer.length))
      out.set(this.ringBuffer.subarray(0, available - firstChunk), firstChunk)
    }

    return available
  }

  /**
   * Stop the ffmpeg process and clean up.
   * Safe to call multiple times.
   */
  stop(): void {
    this._running = false
    if (this.proc) {
      try { this.proc.kill() } catch { /* ignore */ }
      this.proc = null
    }
    this.writePos = 0
    this.totalSamplesWritten = 0
  }

  /**
   * Restart the reader at a new position (e.g. after a seek).
   */
  restart(startPosition = 0): void {
    this.stop()
    this.start(startPosition)
  }

  /** Internal: continuously reads stdout from ffmpeg and fills the ring buffer. */
  private async readLoop(): Promise<void> {
    const stdout = this.proc?.stdout
    if (!stdout || typeof stdout === "number") return

    const reader = (stdout as ReadableStream<Uint8Array>).getReader()
    try {
      while (this._running) {
        const { done, value } = await reader.read()
        if (done || !this._running) break
        if (!value || value.byteLength === 0) continue

        // Convert raw s16le bytes → Float64Array scaled for cavacore
        // Ensure we have an even number of bytes (each sample = 2 bytes)
        const sampleCount = Math.floor(value.byteLength / BYTES_PER_SAMPLE)
        if (sampleCount === 0) continue

        const int16View = new Int16Array(
          value.buffer,
          value.byteOffset,
          sampleCount,
        )

        // Write samples into ring buffer (as doubles, preserving int16 scale)
        for (let i = 0; i < sampleCount; i++) {
          this.ringBuffer[this.writePos] = int16View[i] // ±32768 range
          this.writePos = (this.writePos + 1) % this.ringBuffer.length
          this.totalSamplesWritten++
        }
      }
    } catch {
      // Stream ended or process killed — expected during stop()
    } finally {
      try { reader.releaseLock() } catch { /* ignore */ }
    }
  }
}
