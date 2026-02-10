import { PageProps } from "@/App";
import { PlaybackControls } from "./PlaybackControls";
import { RealtimeWaveform } from "./RealtimeWaveform";
import { useAudio } from "@/hooks/useAudio";
import { useAppStore } from "@/stores/app";
import { useTheme } from "@/context/ThemeContext";

enum PlayerPaneType {
  PLAYER = 1,
}
export const PlayerPaneCount = 1;

export function PlayerPage(props: PageProps) {
  const audio = useAudio();
  const { theme } = useTheme();

  const progressPercent = () => {
    const d = audio.duration();
    if (d <= 0) return 0;
    return Math.min(100, Math.round((audio.position() / d) * 100));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <box flexDirection="column" gap={1} width="100%">
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <strong>Now Playing</strong>
        </text>
        <text fg={theme.muted}>
          {formatTime(audio.position())} / {formatTime(audio.duration())} (
          {progressPercent()}%)
        </text>
      </box>

      {audio.error() && <text fg={theme.error}>{audio.error()}</text>}

      <box border padding={1} flexDirection="column" gap={1}>
        <text fg={theme.text}>
          <strong>{audio.currentEpisode()?.title}</strong>
        </text>
        <text fg={theme.muted}>{audio.currentEpisode()?.description}</text>

        <RealtimeWaveform
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
        hasAudioUrl={!!audio.currentEpisode()?.audioUrl}
        onToggle={audio.togglePlayback}
        onPrev={() => audio.seek(0)}
        onNext={() => audio.seek(audio.currentEpisode()?.duration ?? 0)} //TODO: get next chronological(if feed) or episode(if MyShows)
        onSpeedChange={(s: number) => audio.setSpeed(s)}
        onVolumeChange={(v: number) => audio.setVolume(v)}
      />
    </box>
  );
}
