/**
 * App state persistence — settings, preferences, and custom theme are stored
 * in the centralized `config.json` (see utils/config.ts). Playback progress
 * and audio-nav state stay in separate files (they change on every seek and
 * would thrash config.json).
 *
 * No backups — writes always overwrite.
 */

import { ensureConfigDir, getConfigFilePath } from "./config-dir";
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
	downloadPath: "",
	transparentBackground: false,
	visualizer: defaultVisualizerSettings,
};

const defaultPreferences: UserPreferences = {
	showExplicit: false,
	autoDownload: false,
	autoJumpToPlayer: true,
	fetchMoreMode: "manual",
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
			settings: { ...defaultSettings, ...cfg.settings },
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
