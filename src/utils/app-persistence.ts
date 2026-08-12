/**
 * App state persistence — settings, preferences, and custom theme are stored
 * in the centralized `config.json` (see utils/config.ts). Playback progress
 * and audio-nav state stay in separate files (they change on every seek and
 * would thrash config.json).
 *
 * No backups — writes always overwrite.
 */

import { mkdirSync, writeFileSync } from "fs";
import { ensureConfigDir, getConfigDir, getConfigFilePath } from "./config-dir";
import { loadConfig, updateConfig } from "./config";
import type {
	AppState,
	AppSettings,
	UserPreferences,
	VisualizerSettings,
} from "../types/settings";
import { DEFAULT_THEME } from "../constants/themes";

// --- Defaults ---

const defaultVisualizerSettings: VisualizerSettings = {
	enabled: true,
	bars: 32,
	sensitivity: 1,
	noiseReduction: 0.77,
	lowCutOff: 50,
	highCutOff: 10000,
};

const defaultSettings: AppSettings = {
	theme: "system",
	fontSize: 14,
	playbackSpeed: 1,
	volume: 1,
	downloadPath: "",
	transparentBackground: false,
	showSelectionMarker: false,
	visualizer: defaultVisualizerSettings,
};

const defaultPreferences: UserPreferences = {
	showExplicit: false,
	autoDownload: false,
	autoDownloadCount: 2,
	autoDownloadScope: "all",
	autoDownloadWhitelist: [],
	autoJumpToPlayer: true,
	fetchMoreMode: "auto",
	refreshIntervalMinutes: 30,
};

const defaultState: AppState = {
	settings: defaultSettings,
	preferences: defaultPreferences,
	customTheme: DEFAULT_THEME,
};

// ── App State (config.json) ─────────────────────────────────────────────────

/** Load app state from config.json */
export async function loadAppStateFromFile(): Promise<AppState> {
	try {
		const cfg = await loadConfig();
		if (!cfg || typeof cfg !== "object") return defaultState;
		return {
			settings: {
				...defaultSettings,
				...cfg.settings,
				// Visualizer is nested: a plain spread would let a config
				// saved before a field was added (e.g. `enabled`) clobber
				// the whole object and leave the new field undefined.
				// Deep-merge so defaults backfill missing nested keys.
				visualizer: {
					...defaultVisualizerSettings,
					...cfg.settings?.visualizer,
				},
			},
			preferences: { ...defaultPreferences, ...cfg.preferences },
			customTheme: { ...DEFAULT_THEME, ...cfg.customTheme },
		};
	} catch {
		return defaultState;
	}
}

/** Save app state to config.json */
export function saveAppStateToFile(state: AppState): void {
	updateConfig({
		settings: state.settings,
		preferences: state.preferences,
		customTheme: state.customTheme,
	});
}

// ── Playback Progress (separate file — changes on every seek) ───────────────

const PROGRESS_FILE = "progress.json";

interface ProgressEntry {
	episodeId: string;
	position: number;
	duration: number;
	timestamp: string | Date;
	playbackSpeed?: number;
}

/** Load progress map from JSON file */
export async function loadProgressFromFile(): Promise<
	Record<string, ProgressEntry>
> {
	try {
		const filePath = getConfigFilePath(PROGRESS_FILE);
		const file = Bun.file(filePath);
		if (!(await file.exists())) return {};

		const raw = await file.json();
		if (!raw || typeof raw !== "object") return {};
		return raw as Record<string, ProgressEntry>;
	} catch {
		return {};
	}
}

/** Save progress map to JSON file (overwrite, no backup) */
export function saveProgressToFile(data: Record<string, unknown>): void {
	(async () => {
		try {
			await ensureConfigDir();
			await Bun.write(
				getConfigFilePath(PROGRESS_FILE),
				JSON.stringify(data, null, 2),
			);
		} catch {
			// Silently ignore write errors
		}
	})();
}

// ── Search History (separate file — changes on every search) ────────────────

const SEARCH_HISTORY_FILE = "search-history.json";

/** Load search history from JSON file */
export async function loadSearchHistoryFromFile(): Promise<string[]> {
	try {
		const file = Bun.file(getConfigFilePath(SEARCH_HISTORY_FILE));
		if (!(await file.exists())) return [];

		const raw = await file.json();
		if (!Array.isArray(raw)) return [];
		return raw.filter((item): item is string => typeof item === "string");
	} catch {
		return [];
	}
}

/** Save search history to JSON file (overwrite, no backup) */
export function saveSearchHistoryToFile(history: string[]): void {
	(async () => {
		try {
			await ensureConfigDir();
			await Bun.write(
				getConfigFilePath(SEARCH_HISTORY_FILE),
				JSON.stringify(history, null, 2),
			);
		} catch {
			// Silently ignore write errors
		}
	})();
}

// ── Audio Nav State (separate file — changes on every track change) ──────────

const AUDIO_NAV_FILE = "audio-nav.json";

/** Load audio navigation state from JSON file */
export async function loadAudioNavFromFile<T>(): Promise<T | null> {
	try {
		const file = Bun.file(getConfigFilePath(AUDIO_NAV_FILE));
		if (!(await file.exists())) return null;

		const raw = await file.json();
		if (!raw || typeof raw !== "object") return null;

		return raw as T;
	} catch {
		return null;
	}
}

/** Save audio navigation state to JSON file (overwrite, no backup) */
export function saveAudioNavToFile<T>(data: T): void {
	(async () => {
		try {
			await ensureConfigDir();
			await Bun.write(
				getConfigFilePath(AUDIO_NAV_FILE),
				JSON.stringify(data, null, 2),
			);
		} catch {
			// Silently ignore write errors
		}
	})();
}

// ── Last Player State (separate file — written on every load/stop) ──────────

const LAST_PLAYER_FILE = "last-player.json";

/** Which episode is currently loaded in the player, persisted so the next
 *  launch can restore it paused. `episodeId: null` means the player is empty
 *  (e.g. after Stop). */
export interface LastPlayerState {
	episodeId: string | null;
	timestamp: string | Date | null;
}

/** Load the last-loaded-player marker (null when absent or unreadable) */
export async function loadLastPlayerFromFile(): Promise<LastPlayerState | null> {
	try {
		const file = Bun.file(getConfigFilePath(LAST_PLAYER_FILE));
		if (!(await file.exists())) return null;

		const raw = await file.json();
		if (!raw || typeof raw !== "object") return null;

		return raw as LastPlayerState;
	} catch {
		return null;
	}
}

/** Serialized marker-write chain: concurrent writes land in submission
 *  order, and callers can await the last one (tests read the file back
 *  deterministically). Mirrors updateConfig's write serialization. */
let lastPlayerWriteChain: Promise<void> = Promise.resolve();

/** Save the last-loaded-player marker (fire-and-forget) */
export function saveLastPlayerToFile(state: LastPlayerState): void {
	lastPlayerWriteChain = lastPlayerWriteChain.then(async () => {
		try {
			await ensureConfigDir();
			await Bun.write(
				getConfigFilePath(LAST_PLAYER_FILE),
				JSON.stringify(state, null, 2),
			);
		} catch {
			// Silently ignore write errors
		}
	});
}

/** Resolves once every marker write submitted so far has landed on disk. */
export function waitForLastPlayerWrite(): Promise<void> {
	return lastPlayerWriteChain;
}

/** Synchronous variant for the process-exit teardown. `q` quits through
 *  `process.exit(0)`, which runs exit listeners synchronously — an async
 *  write would never land. */
export function saveLastPlayerSync(state: LastPlayerState): void {
	try {
		mkdirSync(getConfigDir(), { recursive: true });
		writeFileSync(
			getConfigFilePath(LAST_PLAYER_FILE),
			JSON.stringify(state, null, 2),
		);
	} catch {
		// Silently ignore write errors
	}
}
