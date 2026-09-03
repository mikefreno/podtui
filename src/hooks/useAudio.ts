/**
 * Reactive SolidJS hook over the module-level audio engine.
 *
 * Wraps utils/audio-engine: every useAudio() call shares ONE engine (all
 * playback logic, the 150ms poll, session restore, and the event-bus
 * commands live there). This hook keeps only what is tied to the Solid
 * lifecycle — the ref-counted last-owner dispose and the process-exit
 * teardown — and re-exposes the two controls the engine deliberately omits
 * (availablePlayers, switchBackend).
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
	availablePlayers,
	currentEpisode,
	speed,
	setSpeed,
	volume,
	setVolume,
} from "../utils/audio-signals";
import { useAppStore } from "../stores/app";
import { useMediaRegistry } from "../utils/media-registry";
import { saveLastPlayerSync } from "../utils/app-persistence";
import type { BackendName, DetectedPlayer } from "../utils/audio-player";
import {
	createAudioEngine,
	ensureEngineBackend,
	disposeEngineBackend,
	stopEnginePolling,
	getEngineBackend,
	switchBackend,
	restoreLastSession,
	type AudioEngine,
} from "../utils/audio-engine";

// Re-exported so the session-restore test can pull it from this module.
export { restoreLastSession };

// useAudio() surface: the engine plus the two controls it doesn't expose.
export type AudioControls = AudioEngine & {
	availablePlayers: () => DetectedPlayer[];
	switchBackend: (name: BackendName) => Promise<void>;
};

const engine = createAudioEngine();

// Singleton ref count — how many live useAudio() owners there are. The engine
// is shared; the last owner to unmount disposes the backend.
let refCount = 0;

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
		stopEnginePolling();
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
			getEngineBackend()?.dispose();
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

/**
 * Reactive audio controls hook.
 *
 * Returns the shared audio engine wrapped with the two extra controls, so
 * all components observe the same playback state. The first useAudio()
 * owner creates the backend, runs the one-time boot (volume/speed sync +
 * session restore) and registers the process-exit teardown; the last
 * owner disposes the backend.
 */
export function useAudio(): AudioControls {
	const engine = createAudioEngine();
	ensureEngineBackend();
	registerExitTeardown();

	// First owner: sync speed/volume from the persisted settings and restore
	// the last player session once (loaded, not playing). Raw signal
	// accessors are used here on purpose — this is boot-only, not a user
	// volume/speed change, so it must not re-persist to the app store.
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

	onCleanup(() => {
		refCount--;
		if (refCount <= 0) {
			disposeEngineBackend();
			refCount = 0;
		}
	});

	return { ...engine, availablePlayers, switchBackend };
}
