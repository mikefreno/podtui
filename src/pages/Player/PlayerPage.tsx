import { PlaybackControls } from "./PlaybackControls";
import { RealtimeWaveform } from "./RealtimeWaveform";
import { useAudio } from "@/hooks/useAudio";
import { useAppStore } from "@/stores/app";
import { useTheme } from "@/context/ThemeContext";
import { useNavigation } from "@/context/NavigationContext";
import { useKeyboard } from "@opentui/solid";
import { onMount } from "solid-js";

enum PlayerPaneType {
  PLAYER = 1,
}
export const PlayerPaneCount = 1;

export function PlayerPage() {
  const audio = useAudio();
  const { theme } = useTheme();
  const nav = useNavigation();

  onMount(() => {
    useKeyboard(
      (keyEvent: any) => {
        const isNext = keyEvent.key === "l" || keyEvent.key === "ArrowRight";
        const isPrev = keyEvent.key === "h" || keyEvent.key === "ArrowLeft";
        const isPlayPause = keyEvent.key === " " || keyEvent.key === "Enter";

        if (isPlayPause) {
          audio.togglePlayback();
          return;
        }

        if (isNext) {
          audio.seek(audio.currentEpisode()?.duration ?? 0);
          return;
        }

        if (isPrev) {
          audio.seek(0);
          return;
        }
      },
      { release: false },
    );
  });

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
        <text fg={theme.text}>
          <strong>Now Playing</strong>
        </text>
        <text fg={theme.muted}>
          {formatTime(audio.position())} / {formatTime(audio.duration())} (
          {progressPercent()}%)
        </text>
      </box>

      {audio.error() && <text fg={theme.error}>{audio.error()}</text>}

      <box
        border
        borderColor={nav.activeDepth() == PlayerPaneType.PLAYER ? theme.accent : theme.border}
        padding={1}
        flexDirection="column"
        gap={1}
      >
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
