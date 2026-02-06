/**
 * Config file validation and migration for PodTUI
 *
 * Validates JSON structure of config files, handles corrupted files
 * gracefully (falling back to defaults), and provides a single
 * entry-point to migrate all localStorage data to XDG config files.
 */

import { getConfigFilePath } from "./config-dir"
import {
  migrateAppStateFromLocalStorage,
  migrateProgressFromLocalStorage,
} from "./app-persistence"
import {
  migrateFeedsFromLocalStorage,
  migrateSourcesFromLocalStorage,
} from "./feeds-persistence"

// --- Validation helpers ---

/** Check that a value is a non-null object */
function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
}

/** Validate AppState JSON structure */
export function validateAppState(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!isObject(data)) {
    return { valid: false, errors: ["app-state.json is not an object"] }
  }

  // settings
  if (data.settings !== undefined) {
    if (!isObject(data.settings)) {
      errors.push("settings must be an object")
    } else {
      const s = data.settings as Record<string, unknown>
      if (s.theme !== undefined && typeof s.theme !== "string") errors.push("settings.theme must be a string")
      if (s.fontSize !== undefined && typeof s.fontSize !== "number") errors.push("settings.fontSize must be a number")
      if (s.playbackSpeed !== undefined && typeof s.playbackSpeed !== "number") errors.push("settings.playbackSpeed must be a number")
      if (s.downloadPath !== undefined && typeof s.downloadPath !== "string") errors.push("settings.downloadPath must be a string")
    }
  }

  // preferences
  if (data.preferences !== undefined) {
    if (!isObject(data.preferences)) {
      errors.push("preferences must be an object")
    } else {
      const p = data.preferences as Record<string, unknown>
      if (p.showExplicit !== undefined && typeof p.showExplicit !== "boolean") errors.push("preferences.showExplicit must be a boolean")
      if (p.autoDownload !== undefined && typeof p.autoDownload !== "boolean") errors.push("preferences.autoDownload must be a boolean")
    }
  }

  // customTheme
  if (data.customTheme !== undefined && !isObject(data.customTheme)) {
    errors.push("customTheme must be an object")
  }

  return { valid: errors.length === 0, errors }
}

/** Validate feeds JSON structure */
export function validateFeeds(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!Array.isArray(data)) {
    return { valid: false, errors: ["feeds.json is not an array"] }
  }

  for (let i = 0; i < data.length; i++) {
    const feed = data[i]
    if (!isObject(feed)) {
      errors.push(`feeds[${i}] is not an object`)
      continue
    }
    if (typeof feed.id !== "string") errors.push(`feeds[${i}].id must be a string`)
    if (!isObject(feed.podcast)) errors.push(`feeds[${i}].podcast must be an object`)
    if (!Array.isArray(feed.episodes)) errors.push(`feeds[${i}].episodes must be an array`)
  }

  return { valid: errors.length === 0, errors }
}

/** Validate progress JSON structure */
export function validateProgress(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!isObject(data)) {
    return { valid: false, errors: ["progress.json is not an object"] }
  }

  for (const [key, value] of Object.entries(data)) {
    if (!isObject(value)) {
      errors.push(`progress["${key}"] is not an object`)
      continue
    }
    const p = value as Record<string, unknown>
    if (typeof p.episodeId !== "string") errors.push(`progress["${key}"].episodeId must be a string`)
    if (typeof p.position !== "number") errors.push(`progress["${key}"].position must be a number`)
    if (typeof p.duration !== "number") errors.push(`progress["${key}"].duration must be a number`)
  }

  return { valid: errors.length === 0, errors }
}

// --- Safe config file reading ---

/**
 * Safely read and validate a config file.
 * Returns the parsed data if valid, or null if the file is missing/corrupt.
 */
export async function safeReadConfigFile<T>(
  filename: string,
  validator: (data: unknown) => { valid: boolean; errors: string[] },
): Promise<{ data: T | null; errors: string[] }> {
  try {
    const filePath = getConfigFilePath(filename)
    const file = Bun.file(filePath)
    if (!(await file.exists())) {
      return { data: null, errors: [] }
    }

    const text = await file.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { data: null, errors: [`${filename}: invalid JSON`] }
    }

    const result = validator(parsed)
    if (!result.valid) {
      return { data: null, errors: result.errors }
    }

    return { data: parsed as T, errors: [] }
  } catch (err) {
    return { data: null, errors: [`${filename}: ${String(err)}`] }
  }
}

// --- Unified migration ---

/**
 * Run all localStorage -> file migrations.
 * Safe to call multiple times; each migration is a no-op if the target
 * file already exists.
 *
 * Returns a summary of what was migrated.
 */
export async function migrateAllFromLocalStorage(): Promise<{
  appState: boolean
  progress: boolean
  feeds: boolean
  sources: boolean
}> {
  const [appState, progress, feeds, sources] = await Promise.all([
    migrateAppStateFromLocalStorage(),
    migrateProgressFromLocalStorage(),
    migrateFeedsFromLocalStorage(),
    migrateSourcesFromLocalStorage(),
  ])

  return { appState, progress, feeds, sources }
}
