/**
 * App state persistence via JSON file in XDG_CONFIG_HOME
 *
 * Reads and writes app settings, preferences, and custom theme to a JSON file
 */

import { ensureConfigDir, getConfigFilePath } from "./config-dir";
import { backupConfigFile } from "./config-backup";
import type {
  AppState,
  AppSettings,
  UserPreferences,
  VisualizerSettings,
} from "../types/settings";
import { DEFAULT_THEME } from "../constants/themes";

const APP_STATE_FILE = "app-state.json";
const PROGRESS_FILE = "progress.json";
const AUDIO_NAV_FILE = "audio-nav.json";

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
  visualizer: defaultVisualizerSettings,
};

const defaultPreferences: UserPreferences = {
  showExplicit: false,
  autoDownload: false,
};

const defaultState: AppState = {
  settings: defaultSettings,
  preferences: defaultPreferences,
  customTheme: DEFAULT_THEME,
};

// --- App State ---

/** Load app state from JSON file */
export async function loadAppStateFromFile(): Promise<AppState> {
  try {
    const filePath = getConfigFilePath(APP_STATE_FILE);
    const file = Bun.file(filePath);
    if (!(await file.exists())) return defaultState;

    const raw = await file.json();
    if (!raw || typeof raw !== "object") return defaultState;

    const parsed = raw as Partial<AppState>;
    return {
      settings: { ...defaultSettings, ...parsed.settings },
      preferences: { ...defaultPreferences, ...parsed.preferences },
      customTheme: { ...DEFAULT_THEME, ...parsed.customTheme },
    };
  } catch {
    return defaultState;
  }
}

/** Save app state to JSON file */
export async function saveAppStateToFile(state: AppState): Promise<void> {
  try {
    await ensureConfigDir();
    await backupConfigFile(APP_STATE_FILE);
    const filePath = getConfigFilePath(APP_STATE_FILE);
    await Bun.write(filePath, JSON.stringify(state, null, 2));
  } catch {
    // Silently ignore write errors
  }
}

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

/** Save progress map to JSON file */
export async function saveProgressToFile(
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await ensureConfigDir();
    await backupConfigFile(PROGRESS_FILE);
    const filePath = getConfigFilePath(PROGRESS_FILE);
    await Bun.write(filePath, JSON.stringify(data, null, 2));
  } catch {
    // Silently ignore write errors
  }
}

interface AudioNavEntry {
  source: string;
  currentIndex: number;
  podcastId?: string;
  lastUpdated: string;
}

/** Load audio navigation state from JSON file */
export async function loadAudioNavFromFile<T>(): Promise<T | null> {
  try {
    const filePath = getConfigFilePath(AUDIO_NAV_FILE);
    const file = Bun.file(filePath);
    if (!(await file.exists())) return null;

    const raw = await file.json();
    if (!raw || typeof raw !== "object") return null;

    return raw as T;
  } catch {
    return null;
  }
}

/** Save audio navigation state to JSON file */
export async function saveAudioNavToFile<T>(
  data: T,
): Promise<void> {
  try {
    await ensureConfigDir();
    const filePath = getConfigFilePath(AUDIO_NAV_FILE);
    await Bun.write(filePath, JSON.stringify(data, null, 2));
  } catch {
    // Silently ignore write errors
  }
}
