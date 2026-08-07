/**
 * Reactive SolidJS hook wrapping the AudioBackend.
 *
 * Provides signals for playback state and methods for controlling
 * audio. Integrates with the event bus and app store.
 *
 * Usage:
 * ```tsx
 * const audio = useAudio()
 * audio.play(episode)
 * <text>{audio.isPlaying() ? "Playing" : "Paused"}</text>
 * ```
 */

import { createSignal, onCleanup } from "solid-js";
import {
	createAudioBackend,
	detectPlayers,
	type AudioBackend,
	type BackendName,
	type DetectedPlayer,
} from "../utils/audio-player";
import { emit, on } from "../utils/event-bus";
import { useAppStore } from "../stores/app";
import { useProgressStore } from "../stores/progress";
import { useMediaRegistry } from "../utils/media-registry";
import type { Episode } from "../types/episode";
import type { Feed } from "../types/feed";
import { useAudioNavStore, AudioSource } from "../stores/audio-nav";
import { useFeedStore } from "../stores/feed";

export interface AudioControls {
	// Signals (reactive getters)
	isPlaying: () => boolean;
	position: () => number;
	duration: () => number;
	volume: () => number;
	speed: () => number;
	backendName: () => BackendName;
	error: () => string | null;
	currentEpisode: () => Episode | null;
	availablePlayers: () => DetectedPlayer[];

	// Actions
	play: (episode: Episode) => Promise<void>;
	pause: () => Promise<void>;
	resume: () => Promise<void>;
	togglePlayback: () => Promise<void>;
	stop: () => Promise<void>;
	seek: (seconds: number) => Promise<void>;
	seekRelative: (delta: number) => Promise<void>;
	setVolume: (volume: number) => Promise<void>;
	setSpeed: (speed: number) => Promise<void>;
	switchBackend: (name: BackendName) => Promise<void>;
	prev: () => Promise<void>;
	next: () => Promise<void>;
}

// Singleton state — shared across all components that call useAudio()
let backend: AudioBackend | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let refCount = 0;
let pollCount = 0; // Counts poll ticks for throttling progress saves

const [isPlaying, setIsPlaying] = createSignal(false);
const [position, setPosition] = createSignal(0);
const [duration, setDuration] = createSignal(0);
const [volume, setVolume] = createSignal(0.7);
const [speed, setSpeed] = createSignal(1);
const [backendName, setBackendName] = createSignal<BackendName>("none");
const [error, setError] = createSignal<string | null>(null);
const [currentEpisode, setCurrentEpisode] = createSignal<Episode | null>(null);
const [availablePlayers, setAvailablePlayers] = createSignal<DetectedPlayer[]>(
	[],
);

function ensureBackend(): AudioBackend {
	if (!backend) {
		const detected = detectPlayers();
		setAvailablePlayers(detected);
		backend = createAudioBackend();
		setBackendName(backend.name);
		registerExitTeardown();
	}
	return backend;
}

// ── Process-exit teardown ─────────────────────────────────────────────
// `q` (the quit action) calls `process.exit(0)`, which bypasses Solid's
// onCleanup — where `backend.dispose()` would otherwise kill the spawned
// player (mpv/ffplay/afplay). Without this hook those child processes
// survive the host and keep playing audio after the TUI has quit. The
// `exit` event fires synchronously on `process.exit(N)`; the signal
// handlers cover Ctrl-C / kill, which otherwise terminate without running
// `exit` listeners.
let exitTeardownRegistered = false;
function registerExitTeardown(): void {
	if (exitTeardownRegistered) return;
	exitTeardownRegistered = true;
	const teardown = (): void => {
		stopPolling();
		try {
			backend?.dispose();
		} catch {
			/* best-effort at exit */
		}
		try {
			useMediaRegistry().clearNowPlaying();
		} catch {
			/* best-effort at exit */
		}
	};
	process.on("exit", teardown);
	for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
		process.on(sig, () => {
			teardown();
			process.exit(0);
		});
	}
}

function startPolling(): void {
	stopPolling();
	pollCount = 0;
	pollTimer = setInterval(async () => {
		if (!backend || !isPlaying()) return;
		try {
			const pos = await backend.getPosition();
			const dur = await backend.getDuration();
			setPosition(pos);
			if (dur > 0) setDuration(dur);

			// Save progress every ~5 seconds (10 ticks * 500ms)
			pollCount++;
			if (pollCount % 10 === 0) {
				const ep = currentEpisode();
				if (ep) {
					const progressStore = useProgressStore();
					progressStore.update(ep.id, pos, dur > 0 ? dur : duration(), speed());

					// Update platform media position
					const media = useMediaRegistry();
					media.setPosition(pos);
				}
			}

			// Check if backend stopped playing (track ended)
			if (!backend.isPlaying() && isPlaying()) {
				setIsPlaying(false);
				stopPolling();
				// Save final position on track end
				const ep = currentEpisode();
				if (ep) {
					const progressStore = useProgressStore();
					progressStore.update(ep.id, pos, dur > 0 ? dur : duration(), speed());
				}
			}
		} catch {
			// Backend may have been disposed
		}
	}, 500);
}

function stopPolling(): void {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

async function play(episode: Episode): Promise<void> {
	const b = ensureBackend();
	setError(null);

	if (!episode.audioUrl) {
		setError("No audio URL for this episode");
		return;
	}

	try {
		const appStore = useAppStore();
		const progressStore = useProgressStore();
		const storeSpeed = appStore.state().settings.playbackSpeed;
		const vol = volume();
		const spd = storeSpeed || speed();

		// Resume from saved progress if available and not completed
		const savedProgress = progressStore.get(episode.id);
		let startPos = 0;
		if (savedProgress && !progressStore.isCompleted(episode.id)) {
			startPos = savedProgress.position;
		}

		await b.play(episode.audioUrl, {
			volume: vol,
			speed: spd,
			startPosition: startPos > 0 ? startPos : undefined,
		});

		setCurrentEpisode(episode);
		setIsPlaying(true);
		setPosition(startPos);
		setSpeed(spd);
		if (episode.duration) setDuration(episode.duration);

		// Register with platform media controls
		const media = useMediaRegistry();
		media.setNowPlaying({
			title: episode.title,
			artist: episode.podcastId,
			duration: episode.duration,
		});
		media.setPlaybackState(true);
		if (startPos > 0) media.setPosition(startPos);

		startPolling();
		emit("player.play", { episodeId: episode.id });
	} catch (err) {
		setError(err instanceof Error ? err.message : "Playback failed");
		setIsPlaying(false);
	}
}

async function pause(): Promise<void> {
	if (!backend) return;
	try {
		await backend.pause();
		setIsPlaying(false);
		stopPolling();
		const ep = currentEpisode();
		if (ep) {
			// Save progress on pause
			const progressStore = useProgressStore();
			progressStore.update(ep.id, position(), duration(), speed());
			emit("player.pause", { episodeId: ep.id });

			// Update platform media controls
			const media = useMediaRegistry();
			media.setPlaybackState(false);
			media.setPosition(position());
		}
	} catch (err) {
		setError(err instanceof Error ? err.message : "Pause failed");
	}
}

async function resume(): Promise<void> {
	if (!backend) return;
	try {
		await backend.resume();
		setIsPlaying(true);
		startPolling();
		const ep = currentEpisode();
		if (ep) {
			emit("player.play", { episodeId: ep.id });
			const media = useMediaRegistry();
			media.setPlaybackState(true);
		}
	} catch (err) {
		setError(err instanceof Error ? err.message : "Resume failed");
	}
}

async function togglePlayback(): Promise<void> {
	if (isPlaying()) {
		await pause();
	} else if (currentEpisode()) {
		await resume();
	}
}

async function stop(): Promise<void> {
	if (!backend) return;
	try {
		// Save progress before stopping
		const ep = currentEpisode();
		if (ep) {
			const progressStore = useProgressStore();
			progressStore.update(ep.id, position(), duration(), speed());
		}
		await backend.stop();
		setIsPlaying(false);
		setPosition(0);
		setCurrentEpisode(null);
		stopPolling();
		emit("player.stop", {});

		// Clear platform media controls
		const media = useMediaRegistry();
		media.clearNowPlaying();
	} catch (err) {
		setError(err instanceof Error ? err.message : "Stop failed");
	}
}

async function seek(seconds: number): Promise<void> {
	if (!backend) return;
	const clamped = Math.max(0, Math.min(seconds, duration()));
	try {
		await backend.seek(clamped);
		setPosition(clamped);
	} catch (err) {
		setError(err instanceof Error ? err.message : "Seek failed");
	}
}

async function seekRelative(delta: number): Promise<void> {
	await seek(position() + delta);
}

async function doSetVolume(vol: number): Promise<void> {
	const clamped = Math.max(0, Math.min(1, vol));
	if (backend) {
		try {
			await backend.setVolume(clamped);
		} catch {
			// Some backends can't change volume at runtime
		}
	}
	setVolume(clamped);
}

async function doSetSpeed(spd: number): Promise<void> {
	const clamped = Math.max(0.25, Math.min(3, spd));
	if (backend) {
		try {
			await backend.setSpeed(clamped);
		} catch {
			// Some backends can't change speed at runtime
		}
	}
	setSpeed(clamped);

	// Sync back to app store
	try {
		const appStore = useAppStore();
		appStore.updateSettings({ playbackSpeed: clamped });
	} catch {
		// Store may not be available
	}
}

async function switchBackend(name: BackendName): Promise<void> {
	const wasPlaying = isPlaying();
	const ep = currentEpisode();
	const pos = position();
	const vol = volume();
	const spd = speed();

	// Stop current backend
	if (backend) {
		stopPolling();
		backend.dispose();
		backend = null;
	}

	// Create new backend
	backend = createAudioBackend(name);
	setBackendName(backend.name);
	setAvailablePlayers(detectPlayers());

	// Resume playback if we were playing
	if (wasPlaying && ep && ep.audioUrl) {
		try {
			await backend.play(ep.audioUrl, {
				startPosition: pos,
				volume: vol,
				speed: spd,
			});
			setIsPlaying(true);
			startPolling();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Backend switch failed");
			setIsPlaying(false);
		}
	}
}

/**
 * Reactive audio controls hook.
 *
 * Returns a singleton — all components share the same playback state.
 * Registers event bus listeners and cleans them up with onCleanup.
 */
export function useAudio(): AudioControls {
	// Initialize backend on first use
	ensureBackend();

	// Sync initial speed from app store
	if (refCount === 0) {
		try {
			const appStore = useAppStore();
			const storeSpeed = appStore.state().settings.playbackSpeed;
			if (storeSpeed && storeSpeed !== speed()) {
				setSpeed(storeSpeed);
			}
		} catch {
			// Store may not be available yet
		}
	}

	refCount++;

	// Listen for event bus commands (e.g. from other components)
	const unsubPlay = on("player.play", async (data) => {
		// External play requests — currently just tracks episodeId.
		// Episode lookup would require feed store integration.
	});

	const unsubStop = on("player.stop", async () => {
		if (backend && isPlaying()) {
			await backend.stop();
			setIsPlaying(false);
			setPosition(0);
			setCurrentEpisode(null);
			stopPolling();
		}
	});

	// Listen for global multimedia key events (from useMultimediaKeys)
	const unsubMediaToggle = on("media.toggle", async () => {
		await togglePlayback();
	});

	const unsubMediaVolUp = on("media.volumeUp", async () => {
		await doSetVolume(Math.min(1, Number((volume() + 0.05).toFixed(2))));
	});

	const unsubMediaVolDown = on("media.volumeDown", async () => {
		await doSetVolume(Math.max(0, Number((volume() - 0.05).toFixed(2))));
	});

	const unsubMediaSeekFwd = on("media.seekForward", async () => {
		await seekRelative(10);
	});

	const unsubMediaSeekBack = on("media.seekBackward", async () => {
		await seekRelative(-10);
	});

	const unsubMediaSpeed = on("media.speedCycle", async () => {
		const next = speed() >= 2 ? 0.5 : Number((speed() + 0.25).toFixed(2));
		await doSetSpeed(next);
	});

	const audioNav = useAudioNavStore();
	const feedStore = useFeedStore();

	async function prev(): Promise<void> {
		const current = currentEpisode();
		if (!current) return;

		const currentPos = position();
		const currentDur = duration();

		const NAV_START_THRESHOLD = 30;

		if (currentPos > NAV_START_THRESHOLD && currentDur > 0) {
			await seek(NAV_START_THRESHOLD);
		} else {
			const source = audioNav.getSource();
			let episodes: Array<{ episode: Episode; feed: Feed }> = [];

			if (source === AudioSource.FEED) {
				episodes = feedStore.getAllEpisodesChronological();
			} else if (source === AudioSource.MY_SHOWS) {
				const podcastId = audioNav.getPodcastId();
				if (!podcastId) return;

				const feed = feedStore
					.getFilteredFeeds()
					.find((f) => f.podcast.id === podcastId);
				if (!feed) return;

				episodes = feed.episodes.map((ep) => ({ episode: ep, feed }));
			}

			const currentIndex = audioNav.getCurrentIndex();
			const newIndex = Math.max(0, currentIndex - 1);

			if (newIndex < episodes.length && episodes[newIndex]) {
				const { episode } = episodes[newIndex];
				await play(episode);
				audioNav.prev(newIndex);
			}
		}
	}

	async function next(): Promise<void> {
		const current = currentEpisode();
		if (!current) return;

		const source = audioNav.getSource();
		let episodes: Array<{ episode: Episode; feed: Feed }> = [];

		if (source === AudioSource.FEED) {
			episodes = feedStore.getAllEpisodesChronological();
		} else if (source === AudioSource.MY_SHOWS) {
			const podcastId = audioNav.getPodcastId();
			if (!podcastId) return;

			const feed = feedStore
				.getFilteredFeeds()
				.find((f) => f.podcast.id === podcastId);
			if (!feed) return;

			episodes = feed.episodes.map((ep) => ({ episode: ep, feed }));
		}

		const currentIndex = audioNav.getCurrentIndex();
		const newIndex = Math.min(episodes.length - 1, currentIndex + 1);

		if (newIndex >= 0 && episodes[newIndex]) {
			const { episode } = episodes[newIndex];
			await play(episode);
			audioNav.next(newIndex);
		}
	}

	onCleanup(() => {
		refCount--;
		unsubPlay();
		unsubStop();
		unsubMediaToggle();
		unsubMediaVolUp();
		unsubMediaVolDown();
		unsubMediaSeekFwd();
		unsubMediaSeekBack();
		unsubMediaSpeed();

		if (refCount <= 0) {
			stopPolling();
			if (backend) {
				backend.dispose();
				backend = null;
			}
			// Clear media registry on full teardown
			const media = useMediaRegistry();
			media.clearNowPlaying();

			refCount = 0;
		}
	});

	return {
		isPlaying,
		position,
		duration,
		volume,
		speed,
		backendName,
		error,
		currentEpisode,
		availablePlayers,

		play,
		pause,
		resume,
		togglePlayback,
		stop,
		seek,
		seekRelative,
		setVolume: doSetVolume,
		setSpeed: doSetSpeed,
		switchBackend,
		prev,
		next,
	};
}
