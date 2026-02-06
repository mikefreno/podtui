/**
 * MergedWaveform — unified progress bar + waveform display
 *
 * Shows waveform bars coloured to indicate played vs unplayed portions.
 * The played section doubles as the progress indicator, replacing the
 * separate progress bar. Click-to-seek is supported.
 */

import { createSignal, createEffect, onCleanup } from "solid-js"
import { getWaveformData, getWaveformDataSync } from "../utils/audio-waveform"

type MergedWaveformProps = {
  /** Audio URL — used to generate or retrieve waveform data */
  audioUrl: string
  /** Current playback position in seconds */
  position: number
  /** Total duration in seconds */
  duration: number
  /** Whether audio is currently playing */
  isPlaying: boolean
  /** Number of data points / columns */
  resolution?: number
  /** Callback when user clicks to seek */
  onSeek?: (seconds: number) => void
}

/** Block characters for waveform amplitude levels */
const BARS = [".", "-", "~", "=", "#"]

export function MergedWaveform(props: MergedWaveformProps) {
  const resolution = () => props.resolution ?? 64

  // Waveform data — start with sync/cached, kick off async extraction
  const [data, setData] = createSignal<number[]>(
    getWaveformDataSync(props.audioUrl, resolution()),
  )

  // When the audioUrl changes, attempt async extraction for real data
  createEffect(() => {
    const url = props.audioUrl
    const res = resolution()
    if (!url) return

    let cancelled = false
    getWaveformData(url, res).then((result) => {
      if (!cancelled) setData(result)
    })
    onCleanup(() => { cancelled = true })
  })

  const playedRatio = () =>
    props.duration <= 0 ? 0 : Math.min(1, props.position / props.duration)

  const renderLine = () => {
    const d = data()
    const played = Math.floor(d.length * playedRatio())
    const playedColor = props.isPlaying ? "#6fa8ff" : "#7d8590"
    const futureColor = "#3b4252"

    const playedChars = d
      .slice(0, played)
      .map((v) => BARS[Math.min(BARS.length - 1, Math.floor(v * BARS.length))])
      .join("")

    const futureChars = d
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
    const d = data()
    const ratio = d.length === 0 ? 0 : event.x / d.length
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
