/**
 * Module-level audio engine — owns the AudioBackend lifecycle, the 150ms
 * playback poll (progress save + external pause/resume reconciliation),
 * cover-art resolution, session restore, and the event-bus playback
 * commands.
 *
 * `createAudioEngine()` is the only factory. It builds a lazily-booting
 * engine (the backend is created on the first play/load, not here) and
 * returns the SAME instance for the life of the process, so every
 * useAudio() call shares one engine. The Solid-lifecycle parts that can't
 * live at module scope — the ref-counted last-owner dispose and the
 * process-exit teardown — stay in hooks/useAudio, the thin wrapper.
 */

import {
	cachedCoverPath,
	fetchCoverArt,
} from "./cover-art";
import {
	createAudioBackend,
	detectPlayers,
	PlayerRestartedError,
	type AudioBackend,
	type BackendName,
	type DetectedPlayer,
} from "./audio-player";
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
} from "./audio-signals";
import { emit, on } from "./event-bus";
import { useAppStore } from "../stores/app";
import { useProgressStore } from "../stores/progress";
import { useMediaRegistry } from "./media-registry";
import {
	loadLastPlayerFromFile,
	saveLastPlayerToFile,
} from "./app-persistence";
import type { Episode, Progress } from "../types/episode";
import { feedForEpisode } from "./feed-resolve";
import { useAudioNavStore } from "../stores/audio-nav";
import { useDownloadStore } from "../stores/download";
import { useFeedStore } from "../stores/feed";
import { useSearchStore } from "../stores/search";
import {
	nextStep,
	prevStep,
	queueForSource,
} from "./audio-queue";

// Singleton state — shared by every useAudio() owner through the one engine
let backend: AudioBackend | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
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

/** The engine surface useAudio() wraps. Deliberately omits
 *  availablePlayers and switchBackend — the hook re-exposes those from
 *  audio-signals / this module on top of the engine. */
export interface AudioEngine {
	// Signals (reactive getters)
	isPlaying: () => boolean;
	position: () => number;
	duration: () => number;
	volume: () => number;
	speed: () => number;
	backendName: () => BackendName;
	error: () => string | null;
	currentEpisode: () => Episode | null;

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
	prev: () => Promise<void>;
	next: () => Promise<void>;
}

/** True when saved progress is below the restore cutoff. Episodes with no
 *  progress (never reached the persist threshold) or unknown duration count
 *  as eligible — they restore from the start. */
function isRestoreEligible(progress: Progress | undefined): boolean {
	if (!progress || progress.duration <= 0) return true;
	return progress.position / progress.duration < RESTORE_COMPLETION_THRESHOLD;
}

/** Lazily create the shared backend on first use. The process-exit
 *  teardown lives in useAudio (it must survive last-owner dispose), so it is
 *  registered there, not here. */
function ensureBackend(): AudioBackend {
	if (!backend) {
		const detected = detectPlayers();
		setAvailablePlayers(detected);
		backend = createAudioBackend();
		setBackendName(backend.name);
	}
	return backend;
}

/** Poll ticks between paused-state checks (~1s at 150ms/tick). While the
 *  UI believes playback is paused we only need to catch an external
 *  resume (AirPod play tap, lock-screen/media-center play); checking every
 *  tick would just hammer mpv IPC for nothing. */
const PAUSE_WATCH_TICKS = 7;

/** The player process died while we believed playback was live — track
 *  ended (mpv quits at EOF) or the process crashed. Persist the final
 *  position and stop polling. `autoAdvance` is true only when the track
 *  reached its natural end with the player still alive and no stream error
 *  — the signal to keep the queue going. */
function finalizeTrackEnd(autoAdvance: boolean): void {
	setIsPlaying(false);
	stopPolling();
	const ep = currentEpisode();
	if (ep) {
		const progressStore = useProgressStore();
		progressStore.update(ep.id, position(), duration(), speed());
	}
	if (autoAdvance) {
		// The episode finished: play the next one from the source that
		// started it (search results / show / feed). No-op at the end of
		// the list or when the episode isn't in the source list anymore.
		void next().catch(() => {});
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
					// Natural EOF (player alive, no stream error) auto-advances
					// to the next episode; a crashed/killed daemon or a failed
					// stream must not start the next episode on its own.
					finalizeTrackEnd(
						backend.isAlive() && !backend.getPlaybackError(),
					);
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
					finalizeTrackEnd(false);
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

/** Resolve cover art to a local path for mpv's --cover-art-files, per the
 *  call site's latency budget:
 *  "cache"   — disk cache only (sync): resume paths must never wait on the
 *              network, so a miss plays artless and warms for next time.
 *  "bounded" — disk hit, else fetch capped at 1.2s: cold play needs the art
 *              at file LOAD, but a slow cover server must not stall audio.
 *  "await"   — disk hit, else full (8s-bounded) fetch: boot restore preloads
 *              while feeds/progress load anyway, so the wait is free and the
 *              cover must be present when the file loads.
 * fetchCoverArt already short-circuits on the disk cache, so "await" costs
 * nothing on a warm cache. */
async function resolveCoverArt(
	coverUrl: string | undefined,
	mode: "cache" | "bounded" | "await",
): Promise<string | null> {
	if (!coverUrl) return null;
	if (mode === "cache") return cachedCoverPath(coverUrl);
	if (mode === "bounded") {
		const cached = cachedCoverPath(coverUrl);
		if (cached) return cached;
		return Promise.race([
			fetchCoverArt(coverUrl),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
		]);
	}
	return fetchCoverArt(coverUrl);
}

async function play(episode: Episode): Promise<void> {
	const b = ensureBackend();
	setError(null);

	if (!episode.audioUrl) {
		setError("No audio URL for this episode");
		return;
	}

	const appStore = useAppStore();
	const progressStore = useProgressStore();
	const storeSpeed = appStore.state().settings.playbackSpeed;
	const vol = volume();
	const spd = storeSpeed || speed();

	const feed = feedForEpisode(useFeedStore().feeds(), episode);
	const podcastTitle = feed?.customName || feed?.podcast.title || "";
	// Play the downloaded file when present (offline + no network stalls);
	// otherwise stream. Cover resolves to the feed art, falling back to the
	// episode's own image (feeds added by URL may lack a channel cover).
	const downloadStore = useDownloadStore();
	const url = downloadStore.getDownloadedFilePath(episode.id) ?? episode.audioUrl;

	// Resume from saved progress if available and not completed
	const savedProgress = progressStore.get(episode.id);
	let startPos = 0;
	if (savedProgress && !progressStore.isCompleted(episode.id)) {
		startPos = savedProgress.position;
	}

	// Present the new episode in the UI IMMEDIATELY, before the backend load
	// (cover fetch + loadfile can take a few hundred ms): the player tab,
	// status bar, and OS Now Playing must not keep showing the previous
	// episode during the swap. The previous track's poll is stopped so it
	// can't attribute its position/progress to the new episode; polling
	// restarts once the backend is actually playing. Mirrors load()'s
	// synchronous presentation.
	stopPolling();
	setCurrentEpisode(episode);
	setIsPlaying(false);
	startedPlayback = false;
	setPosition(startPos);
	setSpeed(spd);
	if (episode.duration) setDuration(episode.duration);
	const media = useMediaRegistry();
	media.setNowPlaying({
		title: episode.title,
		artist: podcastTitle || episode.podcastId,
		duration: episode.duration,
	});
	media.setPlaybackState(false);
	if (startPos > 0) media.setPosition(startPos);

	try {
		// Cover art only applies at file LOAD (the runtime video-add fallback
		// never becomes an albumart track), so a cold-cache play must wait for
		// the fetch or play artless. Serve the disk cache synchronously; on a
		// miss, await the bounded fetch (covers fetch in ~300ms typically) —
		// past the 1.2s cap, play bare and let the fetch warm the cache.
		const coverArtPath = await resolveCoverArt(
			feed?.podcast.coverUrl ?? episode.imageUrl,
			"bounded",
		);

		await b.play(url, {
			volume: vol,
			speed: spd,
			startPosition: startPos > 0 ? startPos : undefined,
			mediaTitle: episode.title,
			coverArtPath: coverArtPath ?? undefined,
		});

		setIsPlaying(true);
		setPosition(startPos);
		if (episode.duration) setDuration(episode.duration);
		startedPlayback = true;

		// Remember this episode as "loaded in the player" so the next launch
		// can restore it paused (cleared by stop()).
		saveLastPlayerToFile({ episodeId: episode.id, timestamp: new Date() });

		// Register with platform media controls
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
	const feed = feedForEpisode(useFeedStore().feeds(), episode);
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
	const downloadStore = useDownloadStore();
	const url = downloadStore.getDownloadedFilePath(episode.id) ?? episode.audioUrl;
	if (episode.audioUrl && backend) {
		// The preload must carry the cover AT LOAD: cover-art-files only
		// applies when the file loads, and the runtime video-add fallback
		// never becomes an albumart track (verified). Restore already waits
		// on feeds/progress at boot, so the bounded fetch (~300ms typical,
		// 8s worst case) is free. Falls back to the episode's own image when
		// the feed has no channel cover.
		const coverArtPath = await resolveCoverArt(
			feed?.podcast.coverUrl ?? episode.imageUrl,
			"await",
		);
		const backendSnap = backend;
		backendSnap
			.preload(url, {
				volume: volume(),
				speed: storeSpeed || speed(),
				startPosition: pos > 0 ? pos : undefined,
mediaTitle: episode.title,
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

/** mpv was killed/crashed: respawn it and restart playback from the saved
 *  position via the full play path (fresh loadfile, cover art, media
 *  registry). A bare unpause would target a dead — or freshly-idle —
 *  daemon and silently do nothing. */
async function recoverPlayback(): Promise<void> {
	const ep = currentEpisode();
	if (ep && ep.audioUrl) {
		await play(ep);
	} else {
		setError("Player is not running");
	}
}

async function resume(): Promise<void> {
	if (!backend) return;
	if (!backend.isAlive()) {
		await recoverPlayback();
		return;
	}
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
		// Race: the daemon died between the liveness check above and the
		// unpause — backend.resume() respawned it and threw
		// PlayerRestartedError (the fresh daemon has no file loaded).
		if (err instanceof PlayerRestartedError) {
			await recoverPlayback();
			return;
		}
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

/** Switch the active player backend (mpv / afplay / ...). Off the
 *  AudioEngine interface by contract, but kept here (module-scoped) so the
 *  engine owns backend teardown/creation; useAudio re-exposes it. */
export async function switchBackend(name: BackendName): Promise<void> {
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
			const feed = feedForEpisode(useFeedStore().feeds(), ep);
			const podcastTitle = feed?.customName || feed?.podcast.title || "";
			const url =
				useDownloadStore().getDownloadedFilePath(ep.id) ?? ep.audioUrl;
			const coverArtPath = await resolveCoverArt(
				feed?.podcast.coverUrl ?? ep.imageUrl,
				"cache",
			);
			await backend.play(url, {
				startPosition: pos,
				volume: vol,
				speed: spd,
mediaTitle: ep.title,
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

// ── Episode queue navigation ──────────────────────────────────────────────
// `next`/`prev` (and the end-of-episode auto-advance in finalizeTrackEnd)
// move within the ordered list of the source that STARTED the current
// episode: the Feed's chronological list, the current show's episodes, or
// the search results (see utils/audio-queue). Module-level so
// finalizeTrackEnd can auto-advance without a mounted hook owner.

const audioNav = useAudioNavStore();

/** The ordered playable episodes for the source that started playback. */
function queueForCurrentSource(): Episode[] {
	const feedStore = useFeedStore();
	return queueForSource(
		audioNav.getSource(),
		audioNav.getPodcastId(),
		feedStore.feeds(),
		feedStore.getAllEpisodesChronological(),
		useSearchStore().results(),
	);
}

async function next(): Promise<void> {
	const current = currentEpisode();
	if (!current) return;
	const step = nextStep(queueForCurrentSource(), current.id);
	// A duplicated queue entry (same episode id twice) must not make
	// "next" replay the CURRENT episode — that would reload it from
	// saved progress and audibly repeat already-played audio.
	if (!step || step.episode.id === current.id) return;
	await play(step.episode);
	audioNav.next(step.index);
}

async function prev(): Promise<void> {
	const current = currentEpisode();
	if (!current) return;

	// Standard transport behavior: past 30s in, "prev" restarts the current
	// episode; before that it steps back within the source queue.
	const NAV_START_THRESHOLD = 30;
	const currentPos = position();
	const currentDur = duration();
	if (currentPos > NAV_START_THRESHOLD && currentDur > 0) {
		await seek(NAV_START_THRESHOLD);
		return;
	}

	const step = prevStep(queueForCurrentSource(), current.id);
	if (!step) return;
	await play(step.episode);
	audioNav.prev(step.index);
}

// ── Event bus commands ────────────────────────────────────────────────────
// Registered once per process (in createAudioEngine), not per hook owner.
// Every handler is no-op-safe when the backend is absent (e.g. after the
// last owner disposed it).

let eventListenersRegistered = false;
function registerEventListeners(): void {
	if (eventListenersRegistered) return;
	eventListenersRegistered = true;

	on("player.play", async (data) => {
		// External play requests — currently just tracks episodeId.
		// Episode lookup would require feed store integration.
	});

	on("player.stop", async () => {
		if (backend && isPlaying()) {
			await backend.stop();
			setIsPlaying(false);
			setPosition(0);
			setCurrentEpisode(null);
			stopPolling();
		}
	});

	// Global multimedia key events (from useMultimediaKeys)
	on("media.toggle", async () => {
		await togglePlayback();
	});

	on("media.volumeUp", async () => {
		await doSetVolume(Math.min(1, Number((volume() + 0.05).toFixed(2))));
	});

	on("media.volumeDown", async () => {
		await doSetVolume(Math.max(0, Number((volume() - 0.05).toFixed(2))));
	});

	on("media.speedCycle", async () => {
		const next = speed() >= 2 ? 0.5 : Number((speed() + 0.25).toFixed(2));
		await doSetSpeed(next);
	});
}

/** Lazily create the shared backend on first use. Called from useAudio's
 *  boot path (the old hook created it eagerly; tests and the mpv IPC test
 *  rely on the backend existing before the first play). */
export function ensureEngineBackend(): AudioBackend {
	return ensureBackend();
}

/** Full engine teardown for when the last hook owner unmounts: stop the
 *  poll, dispose the backend, and clear the OS media session. (The
 *  process-exit teardown in useAudio does the same minus the media clear,
 *  since the process is ending.) */
export function disposeEngineBackend(): void {
	stopPolling();
	if (backend) {
		backend.dispose();
		backend = null;
	}
	// Clear media registry on full teardown
	useMediaRegistry().clearNowPlaying();
}

/** Stop the poll — one-line wrapper so the process-exit teardown in
 *  useAudio doesn't reach into engine internals. */
export function stopEnginePolling(): void {
	stopPolling();
}

/** The current backend (or null), for useAudio's exit-time dispose. */
export function getEngineBackend(): AudioBackend | null {
	return backend;
}

let engineInstance: AudioEngine | null = null;

/** Build (once) and return the process-wide audio engine. Side-effect-free:
 *  the backend is created lazily on the first play/load, and the event-bus
 *  listeners are registered here. */
export function createAudioEngine(): AudioEngine {
	if (engineInstance) return engineInstance;
	registerEventListeners();
	engineInstance = {
		isPlaying,
		position,
		duration,
		volume,
		speed,
		backendName,
		error,
		currentEpisode,

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
		prev,
		next,
	};
	return engineInstance;
}
