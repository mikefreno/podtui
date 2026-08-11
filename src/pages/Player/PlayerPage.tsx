/**
 * PlayerPage — 2-pane yazi depth view of the now-playing episode.
 *
 *   depth 0 (parent)  — tab list (muted, read-only).
 *   depth 0 (current) — the single now-playing pane (rich view + controls).
 *
 * No preview pane (PaneRow `panes={2}`). Audio transport (play/pause,
 * next/prev, seek) is handled globally by the Shell router (P/N/B/</>); this
 * page only renders the now-playing surface. `h` at depth 0 returns to the
 * tab root.
 */

import { Show, onMount, onCleanup } from "solid-js";
import { PlaybackControls } from "./PlaybackControls";
import { ProgressBar } from "./ProgressBar";
import { RealtimeWaveform } from "./RealtimeWaveform";
import { useAudio } from "@/hooks/useAudio";
import { useVisualizer } from "@/stores/visualizer";
import { useTheme } from "@/context/ThemeContext";
import { useNavigation, DEPTH_CENTER_PANE } from "@/context/NavigationContext";
import { PaneRow } from "@/components/PaneRow";
import { TabListPane } from "@/components/TabPanel";

export const PlayerPaneCount = 1;

export function PlayerPage() {
	const audio = useAudio();
	const { theme } = useTheme();
	const nav = useNavigation();
	const viz = useVisualizer();
	const muted = () => theme.muted || theme.text;

	// The page is mounted exactly while the Player tab is in focus (Shell
	// renders only the active tab), so mount ⇔ focused. Report it to the
	// visualizer store: losing focus starts the unload grace timer instead
	// of killing the pipeline with the page; regaining focus restarts it.
	onMount(() => viz.setFocused(true));
	onCleanup(() => viz.setFocused(false));

	const isActive = () => nav.activePane() === DEPTH_CENTER_PANE;

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

	// ── parent pane: the tab list (muted) ──────────────────────────────────────
	const parentContent = () => <TabListPane muted />;

	// ── current pane: now playing ───────────────────────────────────────────────
	const currentContent = () => (
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
							{ep().description?.slice(0, 500) ?? "No description available."}
						</text>

						<ProgressBar />

						<RealtimeWaveform />
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
			{/* content prop (not a text child): the babel-preset-solid JSX
			 *  transform HTML-escapes static string children (`<` → `&lt;`),
			 *  which opentui renders verbatim; content bypasses that. */}
			<text
				fg={muted()}
				content={"P play/pause  N next  B prev  < > seek  h back"}
			/>
		</box>
	);

	return (
		<PaneRow
			parent={parentContent}
			current={currentContent}
			currentLabel="Player"
			panes={2}
			focused={isActive}
		/>
	);
}
