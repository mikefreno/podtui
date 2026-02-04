type WaveformProps = {
  data: number[]
  position: number
  duration: number
  isPlaying: boolean
  onSeek?: (next: number) => void
}

const bars = [".", "-", "~", "=", "#"]

export function Waveform(props: WaveformProps) {
  const playedRatio = () => (props.duration === 0 ? 0 : props.position / props.duration)

  const renderLine = () => {
    const playedCount = Math.floor(props.data.length * playedRatio())
    const playedColor = props.isPlaying ? "#6fa8ff" : "#7d8590"
    const futureColor = "#3b4252"
    const played = props.data
      .map((value, index) =>
        index <= playedCount
          ? bars[Math.min(bars.length - 1, Math.floor(value * bars.length))]
          : ""
      )
      .join("")
    const upcoming = props.data
      .map((value, index) =>
        index > playedCount
          ? bars[Math.min(bars.length - 1, Math.floor(value * bars.length))]
          : ""
      )
      .join("")

    return (
      <box flexDirection="row" gap={0}>
        <text fg={playedColor}>{played || " "}</text>
        <text fg={futureColor}>{upcoming || " "}</text>
      </box>
    )
  }

  const handleClick = (event: { x: number }) => {
    const ratio = props.data.length === 0 ? 0 : event.x / props.data.length
    const next = Math.max(0, Math.min(props.duration, Math.round(props.duration * ratio)))
    props.onSeek?.(next)
  }

  return (
    <box border padding={1} onMouseDown={handleClick}>
      {renderLine()}
    </box>
  )
}
