/**
 * audio-signals — module-level playback state shared by useAudio and
 * non-component consumers.
 *
 * useAudio's playback state is a module-level singleton (signals live at
 * module scope, every `useAudio()` call shares them). Those signals are
 * declared here so components that must react to playback WITHOUT mounting
 * a `useAudio()` owner — the visualizer store — can subscribe directly via
 * `audioPlaybackSignals` (or the individual accessors/setters), instead of
 * going through the hook. `useAudio()` re-exports nothing from this module
 * for callers; it imports the accessors and setters for its own use.
 */

import { createSignal } from "solid-js";
import type { Episode } from "../types/episode";
import type { BackendName, DetectedPlayer } from "./audio-player";

export const [isPlaying, setIsPlaying] = createSignal(false);
export const [position, setPosition] = createSignal(0);
export const [duration, setDuration] = createSignal(0);
export const [volume, setVolume] = createSignal(1);
export const [speed, setSpeed] = createSignal(1);
export const [backendName, setBackendName] = createSignal<BackendName>("none");
export const [error, setError] = createSignal<string | null>(null);
export const [currentEpisode, setCurrentEpisode] = createSignal<Episode | null>(
	null,
);
export const [availablePlayers, setAvailablePlayers] = createSignal<
	DetectedPlayer[]
>([]);

/**
 * The playback signals the visualizer pipeline reacts to. `useAudio()`
 * itself remains the component-facing surface; this is for module-level
 * consumers that must track playback without a component owner.
 */
export const audioPlaybackSignals = {
	isPlaying,
	position,
	speed,
	currentEpisode,
} as const;
