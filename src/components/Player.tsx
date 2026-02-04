import { createSignal } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { PlaybackControls } from "./PlaybackControls"
import { Waveform } from "./Waveform"
import { createWaveform } from "../utils/waveform"
import type { Episode } from "../types/episode"

type PlayerProps = {
  focused: boolean
  onExit?: () => void
}

const SAMPLE_EPISODE: Episode = {
  id: "sample-ep",
  podcastId: "sample-podcast",
  title: "A Tour of the Productive Mind",
  description: "A short guided session on building creative focus.",
  audioUrl: "",
  duration: 2780,
  pubDate: new Date(),
}

export function Player(props: PlayerProps) {
  const [isPlaying, setIsPlaying] = createSignal(false)
  const [position, setPosition] = createSignal(0)
  const [volume, setVolume] = createSignal(0.7)
  const [speed, setSpeed] = createSignal(1)

  const waveform = () => createWaveform(64)

  useKeyboard((key: { name: string }) => {
    if (!props.focused) return
    if (key.name === "space") {
      setIsPlaying((value: boolean) => !value)
      return
    }
    if (key.name === "escape") {
      props.onExit?.()
      return
    }
    if (key.name === "left") {
      setPosition((value: number) => Math.max(0, value - 10))
    }
    if (key.name === "right") {
      setPosition((value: number) => Math.min(SAMPLE_EPISODE.duration, value + 10))
    }
    if (key.name === "up") {
      setVolume((value: number) => Math.min(1, Number((value + 0.05).toFixed(2))))
    }
    if (key.name === "down") {
      setVolume((value: number) => Math.max(0, Number((value - 0.05).toFixed(2))))
    }
    if (key.name === "s") {
      setSpeed((value: number) => (value >= 2 ? 0.5 : Number((value + 0.25).toFixed(2))))
    }
  })

  const progressPercent = () => Math.round((position() / SAMPLE_EPISODE.duration) * 100)

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <strong>Now Playing</strong>
        </text>
        <text fg="gray">
          Episode {Math.floor(position() / 60)}:{String(Math.floor(position() % 60)).padStart(2, "0")}
        </text>
      </box>

      <box border padding={1} flexDirection="column" gap={1}>
        <text fg="white">
          <strong>{SAMPLE_EPISODE.title}</strong>
        </text>
        <text fg="gray">{SAMPLE_EPISODE.description}</text>

        <box flexDirection="column" gap={1}>
          <box flexDirection="row" gap={1} alignItems="center">
            <text fg="gray">Progress:</text>
            <box flexGrow={1} height={1} backgroundColor="#2a2f3a">
              <box
                width={`${progressPercent()}%`}
                height={1}
                backgroundColor={isPlaying() ? "#6fa8ff" : "#7d8590"}
              />
            </box>
            <text fg="gray">{progressPercent()}%</text>
          </box>

          <Waveform
            data={waveform()}
            position={position()}
            duration={SAMPLE_EPISODE.duration}
            isPlaying={isPlaying()}
            onSeek={(next: number) => setPosition(next)}
          />
        </box>
      </box>

      <PlaybackControls
        isPlaying={isPlaying()}
        volume={volume()}
        speed={speed()}
        onToggle={() => setIsPlaying((value: boolean) => !value)}
        onPrev={() => setPosition(0)}
        onNext={() => setPosition(SAMPLE_EPISODE.duration)}
        onSpeedChange={setSpeed}
        onVolumeChange={setVolume}
      />

      <text fg="gray">Enter dive | Esc up | Space play/pause | Left/Right seek</text>
    </box>
  )
}
