/**
 * RealtimeWaveform — live audio frequency visualization using cavacore.
 *
 * Replaces MergedWaveform during playback. Spawns an independent ffmpeg
 * process to decode the audio stream, feeds PCM samples through cavacore
 * for FFT analysis, and renders frequency bars as colored terminal
 * characters at ~30fps.
 *
 * Falls back gracefully if cavacore is unavailable (loadCavaCore returns null).
 * Same prop interface as MergedWaveform for drop-in replacement.
 */

import { createSignal, createEffect, onCleanup, on, untrack } from "solid-js"
import { loadCavaCore, type CavaCore, type CavaCoreConfig } from "../utils/cavacore"
import { AudioStreamReader } from "../utils/audio-stream-reader"

// ── Types ────────────────────────────────────────────────────────────

export type RealtimeWaveformProps = {
  /** Audio URL — used to start the ffmpeg decode stream */
  audioUrl: string
  /** Current playback position in seconds */
  position: number
  /** Total duration in seconds */
  duration: number
  /** Whether audio is currently playing */
  isPlaying: boolean
  /** Playback speed multiplier (default: 1) */
  speed?: number
  /** Number of frequency bars / columns */
  resolution?: number
  /** Callback when user clicks to seek */
  onSeek?: (seconds: number) => void
  /** Visualizer configuration overrides */
  visualizerConfig?: Partial<CavaCoreConfig>
}

/** Unicode lower block elements: space (silence) through full block (max) */
const BARS = [" ", "\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"]

/** Target frame interval in ms (~30 fps) */
const FRAME_INTERVAL = 33

/** Number of PCM samples to read per frame (512 is a good FFT window) */
const SAMPLES_PER_FRAME = 512

// ── Component ────────────────────────────────────────────────────────

export function RealtimeWaveform(props: RealtimeWaveformProps) {
  const resolution = () => props.resolution ?? 32

  // Frequency bar values (0.0–1.0 per bar)
  const [barData, setBarData] = createSignal<number[]>([])

  // Track whether cavacore is available
  const [available, setAvailable] = createSignal(false)

  let cava: CavaCore | null = null
  let reader: AudioStreamReader | null = null
  let frameTimer: ReturnType<typeof setInterval> | null = null
  let sampleBuffer: Float64Array | null = null

  // ── Lifecycle: init cavacore once ──────────────────────────────────

  const initCava = () => {
    if (cava) return true

    cava = loadCavaCore()
    if (!cava) {
      setAvailable(false)
      return false
    }

    setAvailable(true)
    return true
  }

  // ── Start/stop the visualization pipeline ──────────────────────────

  const startVisualization = (url: string, position: number, speed: number) => {
    stopVisualization()

    if (!url || !initCava() || !cava) return

    // Initialize cavacore with current resolution + any overrides
    const config: CavaCoreConfig = {
      bars: resolution(),
      sampleRate: 44100,
      channels: 1,
      ...props.visualizerConfig,
    }
    cava.init(config)

    // Pre-allocate sample read buffer
    sampleBuffer = new Float64Array(SAMPLES_PER_FRAME)

    // Start ffmpeg decode stream (reuse reader if same URL, else create new)
    if (!reader || reader.url !== url) {
      if (reader) reader.stop()
      reader = new AudioStreamReader({ url })
    }
    reader.start(position, speed)

    // Start render loop
    frameTimer = setInterval(renderFrame, FRAME_INTERVAL)
  }

  const stopVisualization = () => {
    if (frameTimer) {
      clearInterval(frameTimer)
      frameTimer = null
    }
    if (reader) {
      reader.stop()
      // Don't null reader — we reuse it across start/stop cycles
    }
    if (cava?.isReady) {
      cava.destroy()
    }
    sampleBuffer = null
  }

  // ── Render loop (called at ~30fps) ─────────────────────────────────

  const renderFrame = () => {
    if (!cava?.isReady || !reader?.running || !sampleBuffer) return

    // Read available PCM samples from the stream
    const count = reader.read(sampleBuffer)
    if (count === 0) return

    // Feed samples to cavacore → get frequency bars
    const input = count < sampleBuffer.length
      ? sampleBuffer.subarray(0, count)
      : sampleBuffer
    const output = cava.execute(input)

    // Copy bar values to a new array for the signal
    setBarData(Array.from(output))
  }

  // ── Single unified effect: respond to all prop changes ─────────────
  //
  // Instead of three competing effects that each independently call
  // startVisualization() and race against each other, we use ONE effect
  // that tracks all relevant inputs. Position is read with untrack()
  // so normal playback drift doesn't trigger restarts.
  //
  // SolidJS on() with an array of accessors compares each element
  // individually, so the effect only fires when a value actually changes.

  createEffect(
    on(
      [
        () => props.isPlaying,
        () => props.audioUrl,
        () => props.speed ?? 1,
        resolution,
      ],
      ([playing, url, speed]) => {
        if (playing && url) {
          const pos = untrack(() => props.position)
          startVisualization(url, pos, speed)
        } else {
          stopVisualization()
        }
      },
    ),
  )

  // ── Seek detection: lightweight effect for position jumps ──────────
  //
  // Watches position and restarts the reader (not the whole pipeline)
  // only on significant jumps (>2s), which indicate a user seek.
  // This is intentionally a separate effect — it should NOT trigger a
  // full pipeline restart, just restart the ffmpeg stream at the new pos.

  let lastSyncPosition = 0
  createEffect(
    on(
      () => props.position,
      (pos) => {
        if (!props.isPlaying || !reader?.running) {
          lastSyncPosition = pos
          return
        }

        const delta = Math.abs(pos - lastSyncPosition)
        lastSyncPosition = pos

        if (delta > 2) {
          const speed = props.speed ?? 1
          reader.restart(pos, speed)
        }
      },
    ),
  )

  // Cleanup on unmount
  onCleanup(() => {
    stopVisualization()
    if (reader) {
      reader.stop()
      reader = null
    }
    // Don't null cava itself — it can be reused. But do destroy its plan.
    if (cava?.isReady) {
      cava.destroy()
    }
  })

  // ── Rendering ──────────────────────────────────────────────────────

  const playedRatio = () =>
    props.duration <= 0 ? 0 : Math.min(1, props.position / props.duration)

  const renderLine = () => {
    const bars = barData()
    const numBars = resolution()

    // If no data yet, show empty placeholder
    if (bars.length === 0) {
      const placeholder = ".".repeat(numBars)
      return (
        <box flexDirection="row" gap={0}>
          <text fg="#3b4252">{placeholder}</text>
        </box>
      )
    }

    const played = Math.floor(numBars * playedRatio())
    const playedColor = props.isPlaying ? "#6fa8ff" : "#7d8590"
    const futureColor = "#3b4252"

    const playedChars = bars
      .slice(0, played)
      .map((v) => BARS[Math.min(BARS.length - 1, Math.floor(v * BARS.length))])
      .join("")

    const futureChars = bars
      .slice(played)
      .map((v) => BARS[Math.min(BARS.length - 1, Math.floor(v * BARS.length))])
      .join("")

    return (
      <box flexDirection="row" gap={0}>
        <text fg={playedColor}>{playedChars || " "}</text>
        <text fg={futureColor}>{futureChars || " "}</text>
      </box>
    )
  }

  const handleClick = (event: { x: number }) => {
    const numBars = resolution()
    const ratio = numBars === 0 ? 0 : event.x / numBars
    const next = Math.max(
      0,
      Math.min(props.duration, Math.round(props.duration * ratio)),
    )
    props.onSeek?.(next)
  }

  return (
    <box border padding={1} onMouseDown={handleClick}>
      {renderLine()}
    </box>
  )
}

/**
 * Check if cavacore is available on this system.
 * Useful for deciding whether to show RealtimeWaveform or MergedWaveform.
 */
let _cavacoreAvailable: boolean | null = null
export function isCavacoreAvailable(): boolean {
  if (_cavacoreAvailable === null) {
    const cava = loadCavaCore()
    _cavacoreAvailable = cava !== null
  }
  return _cavacoreAvailable
}
