import { useKeyboard } from "@opentui/solid";
import { PlaybackControls } from "./PlaybackControls";
import { RealtimeWaveform } from "./RealtimeWaveform";
import { useAudio } from "@/hooks/useAudio";
import { useAppStore } from "@/stores/app";
import type { Episode } from "@/types/episode";

type PlayerProps = {
  focused: boolean;
  episode?: Episode | null;
  onExit?: () => void;
};

const SAMPLE_EPISODE: Episode = {
  id: "sample-ep",
  podcastId: "sample-podcast",
  title: "A Tour of the Productive Mind",
  description: "A short guided session on building creative focus.",
  audioUrl: "",
  duration: 2780,
  pubDate: new Date(),
};

export function Player(props: PlayerProps) {
  const audio = useAudio();

  // The episode to display — prefer a passed-in episode, then the
  // currently-playing episode, then fall back to the sample.
  const episode = () =>
    props.episode ?? audio.currentEpisode() ?? SAMPLE_EPISODE;
  const dur = () => audio.duration() || episode().duration || 1;

  useKeyboard((key: { name: string }) => {
    if (!props.focused) return;
    if (key.name === "space") {
      if (audio.currentEpisode()) {
        audio.togglePlayback();
      } else {
        // Nothing loaded yet — start playing the displayed episode
        const ep = episode();
        if (ep.audioUrl) {
          audio.play(ep);
        }
      }
      return;
    }
    if (key.name === "escape") {
      props.onExit?.();
      return;
    }
    if (key.name === "left") {
      audio.seekRelative(-10);
    }
    if (key.name === "right") {
      audio.seekRelative(10);
    }
    if (key.name === "up") {
      audio.setVolume(Math.min(1, Number((audio.volume() + 0.05).toFixed(2))));
    }
    if (key.name === "down") {
      audio.setVolume(Math.max(0, Number((audio.volume() - 0.05).toFixed(2))));
    }
    if (key.name === "s") {
      const next =
        audio.speed() >= 2 ? 0.5 : Number((audio.speed() + 0.25).toFixed(2));
      audio.setSpeed(next);
    }
  });

  const progressPercent = () => {
    const d = dur();
    if (d <= 0) return 0;
    return Math.min(100, Math.round((audio.position() / d) * 100));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <strong>Now Playing</strong>
        </text>
        <text fg="gray">
          {formatTime(audio.position())} / {formatTime(dur())} (
          {progressPercent()}%)
        </text>
      </box>

      {audio.error() && <text fg="red">{audio.error()}</text>}

      <box border padding={1} flexDirection="column" gap={1}>
        <text fg="white">
          <strong>{episode().title}</strong>
        </text>
        <text fg="gray">{episode().description}</text>

        <RealtimeWaveform
          audioUrl={episode().audioUrl}
          position={audio.position()}
          duration={dur()}
          isPlaying={audio.isPlaying()}
          speed={audio.speed()}
          onSeek={(next: number) => audio.seek(next)}
          visualizerConfig={(() => {
            const viz = useAppStore().state().settings.visualizer;
            return {
              bars: viz.bars,
              noiseReduction: viz.noiseReduction,
              lowCutOff: viz.lowCutOff,
              highCutOff: viz.highCutOff,
            };
          })()}
        />
      </box>

      <PlaybackControls
        isPlaying={audio.isPlaying()}
        volume={audio.volume()}
        speed={audio.speed()}
        backendName={audio.backendName()}
        hasAudioUrl={!!episode().audioUrl}
        onToggle={() => {
          if (audio.currentEpisode()) {
            audio.togglePlayback();
          } else {
            const ep = episode();
            if (ep.audioUrl) audio.play(ep);
          }
        }}
        onPrev={() => audio.seek(0)}
        onNext={() => audio.seek(dur())}
        onSpeedChange={(s: number) => audio.setSpeed(s)}
        onVolumeChange={(v: number) => audio.setVolume(v)}
      />

      <text fg="gray">
        Space play/pause | Left/Right seek 10s | Up/Down volume | S speed | Esc
        back
      </text>
    </box>
  );
}
