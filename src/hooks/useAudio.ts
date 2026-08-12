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

import { onCleanup } from "solid-js";
import {
	cachedCoverPath,
	fetchCoverArt,
} from "../utils/cover-art";
import {
	createAudioBackend,
	detectPlayers,
	type AudioBackend,
	type BackendName,
	type DetectedPlayer,
} from "../utils/audio-player";
import {
	isPlaying,
	setIsPlaying,
	position,
	setPosition,
	duration,
	setDuration,
	volume,
	setVolume,
	speed,
	setSpeed,
	backendName,
	setBackendName,
	error,
	setError,
	currentEpisode,
	setCurrentEpisode,
	availablePlayers,
	setAvailablePlayers,
} from "../utils/audio-signals";
import { emit, on } from "../utils/event-bus";
import { useAppStore } from "../stores/app";
import { useProgressStore } from "../stores/progress";
import { useMediaRegistry } from "../utils/media-registry";
import {
	loadLastPlayerFromFile,
	saveLastPlayerToFile,
	saveLastPlayerSync,
} from "../utils/app-persistence";
import type { Episode, Progress } from "../types/episode";
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
	/** Load an episode into the player WITHOUT starting playback. */
	load: (episode: Episode) => Promise<void>;
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

// Playback signals are declared in utils/audio-signals.ts (imported above)
// so non-component consumers (the visualizer store) can subscribe without
// mounting a useAudio() owner.

/** True once the current episode has been handed to the backend (play
 *  started). `false` means the episode is only LOADED in the player (e.g.
 *  restored at boot) and the first play action must start the backend
 *  instead of unpausing it. */
let startedPlayback = false;

/** Completion fraction at/above which an episode is NOT restored at boot. */
const RESTORE_COMPLETION_THRESHOLD = 0.98;

/** True when saved progress is below the restore cutoff. Episodes with no
 *  progress (never reached the persist threshold) or unknown duration count
 *  as eligible — they restore from the start. */
function isRestoreEligible(progress: Progress | undefined): boolean {
	if (!progress || progress.duration <= 0) return true;
	return progress.position / progress.duration < RESTORE_COMPLETION_THRESHOLD;
}

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
// player (mpv). Without this hook those child processes
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
		// Persist "what's loaded in the player right now" synchronously —
		// process.exit(0) runs this handler synchronously and an async write
		// would never land. The next launch restores this episode paused.
		try {
			const ep = currentEpisode();
			if (ep) {
				saveLastPlayerSync({ episodeId: ep.id, timestamp: new Date() });
			}
		} catch {
			/* best-effort at exit */
		}
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

/** Poll ticks between paused-state checks (~1s at 150ms/tick). While the
 *  UI believes playback is paused we only need to catch an external
 *  resume (AirPod play tap, lock-screen/media-center play); checking every
 *  tick would just hammer mpv IPC for nothing. */
const PAUSE_WATCH_TICKS = 7;

/** The player process died while we believed playback was live — track
 *  ended (mpv quits at EOF) or the process crashed. Persist the final
 *  position and stop polling. */
function finalizeTrackEnd(): void {
	setIsPlaying(false);
	stopPolling();
	const ep = currentEpisode();
	if (ep) {
		const progressStore = useProgressStore();
		progressStore.update(ep.id, position(), duration(), speed());
	}
}

/** mpv paused itself OUTSIDE PodTUI — system sleep/lock, AirPod removal,
 *  device swap, OS media keys, the Now Playing center. Bring the UI in
 *  sync; the poll stays armed so an external resume is caught too. */
function reconcileExternalPause(): void {
	setIsPlaying(false);
	const ep = currentEpisode();
	if (ep) {
		const progressStore = useProgressStore();
		progressStore.update(ep.id, position(), duration(), speed());
		emit("player.pause", { episodeId: ep.id });
		const media = useMediaRegistry();
		media.setPlaybackState(false);
		media.setPosition(position());
	}
}

/** Playback was restarted from outside PodTUI (AirPods, lock-screen or
 *  media-center play, OS media keys). Bring the UI back to "playing". */
function reconcileExternalResume(): void {
	setIsPlaying(true);
	const ep = currentEpisode();
	if (ep) {
		emit("player.play", { episodeId: ep.id });
		useMediaRegistry().setPlaybackState(true);
	}
}

function startPolling(): void {
	stopPolling();
	pollCount = 0;
	// Guard against overlapping ticks if a socket read ever outlives the
	// interval (getPosition opens a fresh mpv IPC connection per call).
	let pollInFlight = false;
	pollTimer = setInterval(async () => {
		if (!backend || pollInFlight) return;
		pollInFlight = true;
		try {
			pollCount++;
			if (isPlaying()) {
				// Track ended (eof-reached observed) or process died. Check
				// BEFORE pause reconciliation: mpv keeps the file open at EOF
				// and reports pause=true there, which would otherwise be
				// mistaken for an external pause and never finalize.
				if (!backend.isPlaying()) {
					finalizeTrackEnd();
					return;
				}

				// mpv can pause itself outside PodTUI. Reconcile instead of
				// staying stuck on "playing" with a frozen waveform
				// (getPosition would just re-read the same frozen time-pos).
				const paused = await backend.getPauseState();
				if (paused === true) {
					reconcileExternalPause();
					return;
				}

				const pos = await backend.getPosition();
				const dur = await backend.getDuration();
				setPosition(pos);
				if (dur > 0) setDuration(dur);

				// Save progress every ~5 seconds (33 ticks * 150ms)
				if (pollCount % 33 === 0) {
					const ep = currentEpisode();
					if (ep) {
						const progressStore = useProgressStore();
						progressStore.update(ep.id, pos, dur > 0 ? dur : duration(), speed());

						const media = useMediaRegistry();
						media.setPosition(pos);
					}
				}
			} else if (pollCount % PAUSE_WATCH_TICKS === 0) {
				// Paused — watch for playback restarted from outside (AirPods,
				// lock-screen/media-center play). Only while the player is
				// still alive: a dead player while we thought we were paused
				// means the track ended (mpv quits at EOF) or it crashed.
				if (!backend.isAlive()) {
					finalizeTrackEnd();
					return;
				}
				const paused = await backend.getPauseState();
				if (paused === false) {
					reconcileExternalResume();
				}
			}
		} catch {
			// Backend may have been disposed
		} finally {
			pollInFlight = false;
		}
	}, 150);
}

function stopPolling(): void {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

// ── Cover art for system Now Playing ─────────────────────────────────────────
// macOS shows the media session's albumart in the audio center; mpv reads it
// from `--cover-art-files`. Shared helper (utils/cover-art.ts) fetches the
// podcast cover to a temp file BEFORE playback starts, bounded to 3s.

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

		const feedStore = useFeedStore();
		const feed = feedStore.feeds().find((f) => f.podcast.id === episode.podcastId);
		const podcastTitle = feed?.customName || feed?.podcast.title || "";
		// Cover art only applies at file LOAD (the runtime video-add fallback
		// never becomes an albumart track), so a cold-cache play must wait for
		// the fetch or play artless. Serve the disk cache synchronously; on a
		// miss, await the single-flight fetch with a 1.2s cap (covers fetch in
		// ~300ms typically) — past the cap, play bare and let the fetch warm
		// the cache for next time.
		const coverUrl = feed?.podcast.coverUrl;
		let coverArtPath = coverUrl ? cachedCoverPath(coverUrl) : null;
		if (coverUrl && !coverArtPath) {
			const path = await Promise.race([
				fetchCoverArt(coverUrl),
				new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
			]);
			if (path) coverArtPath = path;
		}

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
			mediaTitle: podcastTitle ? `${podcastTitle} — ${episode.title}` : episode.title,
			coverArtPath: coverArtPath ?? undefined,
		});

		setCurrentEpisode(episode);
		setIsPlaying(true);
		setPosition(startPos);
		setSpeed(spd);
		if (episode.duration) setDuration(episode.duration);
		startedPlayback = true;

		// Remember this episode as "loaded in the player" so the next launch
		// can restore it paused (cleared by stop()).
		saveLastPlayerToFile({ episodeId: episode.id, timestamp: new Date() });

		// Register with platform media controls
		const media = useMediaRegistry();
		media.setNowPlaying({
			title: episode.title,
			artist: podcastTitle || episode.podcastId,
			duration: episode.duration,
		});
		media.setPlaybackState(true);
		if (startPos > 0) media.setPosition(startPos);

		startPolling();
		emit("player.play", { episodeId: episode.id });
		// Distinct from "player.play" (which also fires on resume): signals a
		// fresh episode start so Shell can honor the auto-jump-to-player pref.
		emit("player.started", { episodeId: episode.id });
	} catch (err) {
		setError(err instanceof Error ? err.message : "Playback failed");
		setIsPlaying(false);
	}
}

/**
 * Load an episode into the player WITHOUT starting playback. The player tab
 * renders it paused at its saved position; the first play action starts the
 * backend from there (see togglePlayback). Used to restore the last player
 * session at boot.
 */
async function load(episode: Episode): Promise<void> {
	ensureBackend();
	setError(null);

	setCurrentEpisode(episode);
	setIsPlaying(false);
	startedPlayback = false;

	// Show the saved position so the player tab reflects where playback
	// will resume; episodes at/above the completion threshold start from 0.
	const progressStore = useProgressStore();
	const saved = progressStore.get(episode.id);
	const pos = saved && isRestoreEligible(saved) ? saved.position : 0;
	setPosition(pos);
	if (episode.duration) setDuration(episode.duration);

	const appStore = useAppStore();
	const storeSpeed = appStore.state().settings.playbackSpeed;
	setSpeed(storeSpeed || speed());

	// Surface the loaded-but-paused track to the OS media controls.
	const feedStore = useFeedStore();
	const feed = feedStore.feeds().find((f) => f.podcast.id === episode.podcastId);
	const podcastTitle = feed?.customName || feed?.podcast.title || "";
	const media = useMediaRegistry();
	media.setNowPlaying({
		title: episode.title,
		artist: podcastTitle || episode.podcastId,
		duration: episode.duration,
	});
	media.setPlaybackState(false);
	if (pos > 0) media.setPosition(pos);

	// Preload the episode into the backend PAUSED: mpv opens the stream and
	// fills its demuxer cache while parked, so the user's first Play flips
	// `pause` off instead of paying the ~2s stream-open cold. Fire-and-forget
	// — a failed preload just makes the first play take the cold path.
	if (episode.audioUrl && backend) {
		// The preload must carry the cover AT LOAD: cover-art-files only
		// applies when the file loads, and the runtime video-add fallback
		// never becomes an albumart track (verified). Restore already waits
		// on feeds/progress at boot, so the bounded fetch (~300ms typical,
		// 8s worst case) is free.
		const coverUrl = feed?.podcast.coverUrl;
		const coverArtPath = coverUrl ? await fetchCoverArt(coverUrl) : null;
		const backendSnap = backend;
		backendSnap
			.preload(episode.audioUrl, {
				volume: volume(),
				speed: storeSpeed || speed(),
				startPosition: pos > 0 ? pos : undefined,
				mediaTitle: podcastTitle
					? `${podcastTitle} — ${episode.title}`
					: episode.title,
				coverArtPath: coverArtPath ?? undefined,
			})
			.catch(() => {});
	}

	saveLastPlayerToFile({ episodeId: episode.id, timestamp: new Date() });
}

async function pause(): Promise<void> {
	if (!backend) return;
	try {
		await backend.pause();
		setIsPlaying(false);
		// Polling stays armed (paused-watch mode): playback can be resumed
		// from OUTSIDE PodTUI — AirPods, lock-screen/media-center play —
		// and the poll must be live to catch it.
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
		if (startedPlayback) {
			await resume();
		} else {
			// Episode is only LOADED (e.g. restored at boot) — the backend
			// was never started, so unpausing a dead player would fail
			// silently. Start playback from the saved position instead.
			const ep = currentEpisode();
			if (ep) await play(ep);
		}
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
		startedPlayback = false;
		stopPolling();
		emit("player.stop", {});

		// Player is empty again — nothing to restore on the next launch.
		saveLastPlayerToFile({ episodeId: null, timestamp: null });

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

	// Sync back to app store (persisted to config.json for the next launch).
	const appStore = useAppStore();
	appStore.updateSettings({ volume: clamped });
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
	const appStore = useAppStore();
	appStore.updateSettings({ playbackSpeed: clamped });
}

async function switchBackend(name: BackendName): Promise<void> {
	const wasPlaying = isPlaying();
	const ep = currentEpisode();
	const pos = position();
	const vol = volume();
	const spd = speed();

	if (backend) {
		stopPolling();
		backend.dispose();
		backend = null;
	}

	backend = createAudioBackend(name);
	setBackendName(backend.name);
	setAvailablePlayers(detectPlayers());

	// Resume playback if we were playing
	if (wasPlaying && ep && ep.audioUrl) {
		try {
			const feedStore = useFeedStore();
			const feed = feedStore
				.feeds()
				.find((f) => f.podcast.id === ep.podcastId);
			const podcastTitle = feed?.customName || feed?.podcast.title || "";
			const coverUrl = feed?.podcast.coverUrl;
			const coverArtPath = coverUrl ? cachedCoverPath(coverUrl) : null;
			await backend.play(ep.audioUrl, {
				startPosition: pos,
				volume: vol,
				speed: spd,
				mediaTitle: podcastTitle
					? `${podcastTitle} — ${ep.title}`
					: ep.title,
				coverArtPath: coverArtPath ?? undefined,
			});
			setIsPlaying(true);
			startedPlayback = true;
			startPolling();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Backend switch failed");
			setIsPlaying(false);
		}
	}
}

/** Serialized restore chain: the boot-triggered restore and any explicit
 *  call run one after another, so a late-finishing earlier restore can never
 *  overwrite state changed by a later one (and callers can await the latest
 *  attempt deterministically). */
let restoreChain: Promise<void> = Promise.resolve();

/**
 * Boot-time session restore: reload the episode that was loaded in the
 * player when the previous run ended (persisted on play/load and at exit),
 * paused at its saved position — never autostarted. Episodes at/above the
 * completion threshold are skipped. Silently no-ops when there is nothing
 * to restore (empty player, unsubscribed show, or completed episode).
 */
export async function restoreLastSession(): Promise<void> {
	const attempt = restoreChain.then(async () => {
		const marker = await loadLastPlayerFromFile();
		if (!marker?.episodeId) return;

		// Feeds and progress load asynchronously at boot; wait for both
		// before looking the episode up.
		await Promise.all([
			useProgressStore().whenReady(),
			useFeedStore().whenReady(),
		]);

		const episode = useFeedStore().findEpisode(marker.episodeId);
		if (!episode) return;

		// Only restore episodes below the completion threshold.
		const saved = useProgressStore().get(episode.id);
		if (!isRestoreEligible(saved)) return;

		await load(episode);
	});
	// Keep the chain alive even when an attempt fails; the caller awaiting
	// this attempt still observes its own outcome.
	restoreChain = attempt.catch(() => {});
	await attempt;
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

	// Sync initial speed/volume from app store (reuse the previous session's
	// playback levels; defaults are 1x and 100%).
	if (refCount === 0) {
		const appStore = useAppStore();
		const storeSpeed = appStore.state().settings.playbackSpeed;
		if (storeSpeed && storeSpeed !== speed()) {
			setSpeed(storeSpeed);
		}

		// Volume re-syncs once settings finish loading (async config read)
		// so a level persisted last session is applied at boot.
		appStore
			.whenReady()
			.then(() => {
				const storeVolume = appStore.state().settings.volume;
				if (storeVolume !== undefined && storeVolume !== volume()) {
					setVolume(storeVolume);
				}
			})
			.catch(() => {});

		// Restore the last player session once at boot (loaded, not playing).
		restoreLastSession().catch(() => {});
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
		load,
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
