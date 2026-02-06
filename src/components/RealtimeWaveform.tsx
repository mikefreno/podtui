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

import { createSignal, createEffect, onCleanup, on } from "solid-js"
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

  const startVisualization = (url: string, position: number) => {
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

    // Start ffmpeg decode stream
    reader = new AudioStreamReader({ url })
    reader.start(position)

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
      reader = null
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

  // ── Reactive effects: respond to prop changes ──────────────────────

  // Start/stop based on isPlaying and audioUrl
  createEffect(
    on(
      () => [props.isPlaying, props.audioUrl] as const,
      ([playing, url]) => {
        if (playing && url) {
          startVisualization(url, props.position)
        } else {
          stopVisualization()
          // Keep last bar data visible (freeze frame) when paused
        }
      },
    ),
  )

  // Handle seeks: restart the ffmpeg stream at the new position
  // We track position and restart only on significant jumps (>2s delta)
  let lastSyncPosition = 0
  createEffect(
    on(
      () => props.position,
      (pos) => {
        if (!props.isPlaying || !reader?.running) return

        const delta = Math.abs(pos - lastSyncPosition)
        // Only restart on seeks (>2s jump), not normal playback drift
        if (delta > 2) {
          reader.restart(pos)
          lastSyncPosition = pos
        } else {
          lastSyncPosition = pos
        }
      },
    ),
  )

  // Re-init cavacore if resolution changes
  createEffect(
    on(resolution, (bars) => {
      if (props.isPlaying && props.audioUrl && cava) {
        // Restart with new bar count
        startVisualization(props.audioUrl, props.position)
      }
    }),
  )

  // Cleanup on unmount
  onCleanup(() => {
    stopVisualization()
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
