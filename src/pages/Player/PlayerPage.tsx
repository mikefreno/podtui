/**
 * PlayerPage — single-pane audio now-playing view.
 *
 * Audio transport (play/pause, next/prev, seek) is handled globally by the
 * Shell router (P/N/B/</>). This page renders a single rich pane showing the
 * current episode, waveform, and playback controls. Panes/swipe do nothing
 * (PaneCount=1).
 */

import { Show } from "solid-js";
import { PlaybackControls } from "./PlaybackControls";
import { RealtimeWaveform } from "./RealtimeWaveform";
import { useAudio } from "@/hooks/useAudio";
import { useAppStore } from "@/stores/app";
import { useTheme } from "@/context/ThemeContext";
import { useNavigation } from "@/context/NavigationContext";

export const PlayerPaneCount = 1;

export function PlayerPage() {
	const audio = useAudio();
	const { theme } = useTheme();
	const nav = useNavigation();
	const muted = () => theme.muted || theme.text;

	// Single pane — always active.
	const isActive = () => true;
	const border = () => theme.accent;

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
		<box flexDirection="column" width="100%" height="100%">
			{/* ── pane 0: now playing ─────────────────────────────────────────── */}
			<box height={1} paddingLeft={1} backgroundColor={theme.background}>
				<text fg={theme.textSecondary}>Player</text>
			</box>
			<scrollbox
				height="100%"
				focused={isActive()}
				border
				borderColor={border()}
				backgroundColor={theme.background}
			>
				<box flexDirection="column" gap={1} padding={1}>
					<box flexDirection="row" justifyContent="space-between">
						<text fg={theme.text}>
							<strong>Now Playing</strong>
						</text>
						<text fg={muted()}>
							{formatTime(audio.position())} / {formatTime(audio.duration())} (
							{progressPercent()}%)
						</text>
					</box>

					<Show when={audio.error()}>
						{(err) => <text fg={theme.error}>{err()}</text>}
					</Show>

					<Show
						when={audio.currentEpisode()}
						fallback={
							<box padding={1}>
								<text fg={muted()}>No episode loaded.</text>
							</box>
						}
					>
						{(ep) => (
							<box flexDirection="column" gap={1}>
								<text fg={theme.text}>
									<strong>{ep().title}</strong>
								</text>
								<text fg={muted()}>
									{ep().description?.slice(0, 500) ??
										"No description available."}
								</text>

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
						)}
					</Show>

					<PlaybackControls
						isPlaying={audio.isPlaying()}
						volume={audio.volume()}
						speed={audio.speed()}
						backendName={audio.backendName()}
						hasAudioUrl={!!audio.currentEpisode()?.audioUrl}
						onToggle={audio.togglePlayback}
						onPrev={() => audio.seek(0)}
						onNext={() => audio.seek(audio.currentEpisode()?.duration ?? 0)}
						onSpeedChange={(s: number) => audio.setSpeed(s)}
						onVolumeChange={(v: number) => audio.setVolume(v)}
					/>

					<box height={1} />
					<text fg={muted()}>{"P play/pause  N next  B prev  </ seek"}</text>
				</box>
			</scrollbox>
		</box>
	);
}
