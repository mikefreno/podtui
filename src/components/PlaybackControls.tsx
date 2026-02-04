type PlaybackControlsProps = {
  isPlaying: boolean
  volume: number
  speed: number
  onToggle: () => void
  onPrev: () => void
  onNext: () => void
  onVolumeChange: (value: number) => void
  onSpeedChange: (value: number) => void
}

export function PlaybackControls(props: PlaybackControlsProps) {
  return (
    <box flexDirection="row" gap={1} alignItems="center" border padding={1}>
      <box border padding={0} onMouseDown={props.onPrev}>
        <text fg="cyan">[Prev]</text>
      </box>
      <box border padding={0} onMouseDown={props.onToggle}>
        <text fg="cyan">{props.isPlaying ? "[Pause]" : "[Play]"}</text>
      </box>
      <box border padding={0} onMouseDown={props.onNext}>
        <text fg="cyan">[Next]</text>
      </box>
      <box flexDirection="row" gap={1} marginLeft={2}>
        <text fg="gray">Vol</text>
        <text fg="white">{Math.round(props.volume * 100)}%</text>
      </box>
      <box flexDirection="row" gap={1} marginLeft={2}>
        <text fg="gray">Speed</text>
        <text fg="white">{props.speed}x</text>
      </box>
    </box>
  )
}
