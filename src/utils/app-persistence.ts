/**
 * App state persistence via JSON file in XDG_CONFIG_HOME
 *
 * Reads and writes app settings, preferences, and custom theme to a JSON file
 * instead of localStorage. Provides migration from localStorage on first run.
 */

import { ensureConfigDir, getConfigFilePath } from "./config-dir"
import { backupConfigFile } from "./config-backup"
import type { AppState, AppSettings, UserPreferences, ThemeColors, VisualizerSettings } from "../types/settings"
import { DEFAULT_THEME } from "../constants/themes"

const APP_STATE_FILE = "app-state.json"
const PROGRESS_FILE = "progress.json"

const LEGACY_APP_STATE_KEY = "podtui_app_state"
const LEGACY_PROGRESS_KEY = "podtui_progress"

// --- Defaults ---

const defaultVisualizerSettings: VisualizerSettings = {
  bars: 32,
  sensitivity: 1,
  noiseReduction: 0.77,
  lowCutOff: 50,
  highCutOff: 10000,
}

const defaultSettings: AppSettings = {
  theme: "system",
  fontSize: 14,
  playbackSpeed: 1,
  downloadPath: "",
  visualizer: defaultVisualizerSettings,
}

const defaultPreferences: UserPreferences = {
  showExplicit: false,
  autoDownload: false,
}

const defaultState: AppState = {
  settings: defaultSettings,
  preferences: defaultPreferences,
  customTheme: DEFAULT_THEME,
}

// --- App State ---

/** Load app state from JSON file */
export async function loadAppStateFromFile(): Promise<AppState> {
  try {
    const filePath = getConfigFilePath(APP_STATE_FILE)
    const file = Bun.file(filePath)
    if (!(await file.exists())) return defaultState

    const raw = await file.json()
    if (!raw || typeof raw !== "object") return defaultState

    const parsed = raw as Partial<AppState>
    return {
      settings: { ...defaultSettings, ...parsed.settings },
      preferences: { ...defaultPreferences, ...parsed.preferences },
      customTheme: { ...DEFAULT_THEME, ...parsed.customTheme },
    }
  } catch {
    return defaultState
  }
}

/** Save app state to JSON file */
export async function saveAppStateToFile(state: AppState): Promise<void> {
  try {
    await ensureConfigDir()
    await backupConfigFile(APP_STATE_FILE)
    const filePath = getConfigFilePath(APP_STATE_FILE)
    await Bun.write(filePath, JSON.stringify(state, null, 2))
  } catch {
    // Silently ignore write errors
  }
}

/**
 * Migrate app state from localStorage to file.
 * Only runs once — if the state file already exists, it's a no-op.
 */
export async function migrateAppStateFromLocalStorage(): Promise<boolean> {
  try {
    const filePath = getConfigFilePath(APP_STATE_FILE)
    const file = Bun.file(filePath)
    if (await file.exists()) return false

    if (typeof localStorage === "undefined") return false

    const raw = localStorage.getItem(LEGACY_APP_STATE_KEY)
    if (!raw) return false

    const parsed = JSON.parse(raw) as Partial<AppState>
    const state: AppState = {
      settings: { ...defaultSettings, ...parsed.settings },
      preferences: { ...defaultPreferences, ...parsed.preferences },
      customTheme: { ...DEFAULT_THEME, ...parsed.customTheme },
    }

    await saveAppStateToFile(state)
    return true
  } catch {
    return false
  }
}

// --- Progress ---

interface ProgressEntry {
  episodeId: string
  position: number
  duration: number
  timestamp: string | Date
  playbackSpeed?: number
}

/** Load progress map from JSON file */
export async function loadProgressFromFile(): Promise<Record<string, ProgressEntry>> {
  try {
    const filePath = getConfigFilePath(PROGRESS_FILE)
    const file = Bun.file(filePath)
    if (!(await file.exists())) return {}

    const raw = await file.json()
    if (!raw || typeof raw !== "object") return {}
    return raw as Record<string, ProgressEntry>
  } catch {
    return {}
  }
}

/** Save progress map to JSON file */
export async function saveProgressToFile(data: Record<string, unknown>): Promise<void> {
  try {
    await ensureConfigDir()
    await backupConfigFile(PROGRESS_FILE)
    const filePath = getConfigFilePath(PROGRESS_FILE)
    await Bun.write(filePath, JSON.stringify(data, null, 2))
  } catch {
    // Silently ignore write errors
  }
}

/**
 * Migrate progress from localStorage to file.
 * Only runs once — if the progress file already exists, it's a no-op.
 */
export async function migrateProgressFromLocalStorage(): Promise<boolean> {
  try {
    const filePath = getConfigFilePath(PROGRESS_FILE)
    const file = Bun.file(filePath)
    if (await file.exists()) return false

    if (typeof localStorage === "undefined") return false

    const raw = localStorage.getItem(LEGACY_PROGRESS_KEY)
    if (!raw) return false

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return false

    await saveProgressToFile(parsed as Record<string, unknown>)
    return true
  } catch {
    return false
  }
}
