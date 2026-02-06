/**
 * Feeds persistence via JSON file in XDG_CONFIG_HOME
 *
 * Reads and writes feeds to a JSON file instead of localStorage.
 * Provides migration from localStorage on first run.
 */

import { ensureConfigDir, getConfigFilePath } from "./config-dir"
import { backupConfigFile } from "./config-backup"
import type { Feed } from "../types/feed"

const FEEDS_FILE = "feeds.json"
const SOURCES_FILE = "sources.json"

/** Deserialize date strings back to Date objects in feed data */
function reviveDates(feed: Feed): Feed {
  return {
    ...feed,
    lastUpdated: new Date(feed.lastUpdated),
    podcast: {
      ...feed.podcast,
      lastUpdated: new Date(feed.podcast.lastUpdated),
    },
    episodes: feed.episodes.map((ep) => ({
      ...ep,
      pubDate: new Date(ep.pubDate),
    })),
  }
}

/** Load feeds from JSON file */
export async function loadFeedsFromFile(): Promise<Feed[]> {
  try {
    const filePath = getConfigFilePath(FEEDS_FILE)
    const file = Bun.file(filePath)
    if (!(await file.exists())) return []

    const raw = await file.json()
    if (!Array.isArray(raw)) return []
    return raw.map(reviveDates)
  } catch {
    return []
  }
}

/** Save feeds to JSON file */
export async function saveFeedsToFile(feeds: Feed[]): Promise<void> {
  try {
    await ensureConfigDir()
    await backupConfigFile(FEEDS_FILE)
    const filePath = getConfigFilePath(FEEDS_FILE)
    await Bun.write(filePath, JSON.stringify(feeds, null, 2))
  } catch {
    // Silently ignore write errors
  }
}

/** Load sources from JSON file */
export async function loadSourcesFromFile<T>(): Promise<T[] | null> {
  try {
    const filePath = getConfigFilePath(SOURCES_FILE)
    const file = Bun.file(filePath)
    if (!(await file.exists())) return null

    const raw = await file.json()
    if (!Array.isArray(raw)) return null
    return raw as T[]
  } catch {
    return null
  }
}

/** Save sources to JSON file */
export async function saveSourcesToFile<T>(sources: T[]): Promise<void> {
  try {
    await ensureConfigDir()
    await backupConfigFile(SOURCES_FILE)
    const filePath = getConfigFilePath(SOURCES_FILE)
    await Bun.write(filePath, JSON.stringify(sources, null, 2))
  } catch {
    // Silently ignore write errors
  }
}

/**
 * Migrate feeds from localStorage to file.
 * Only runs once — if the feeds file already exists, it's a no-op.
 */
export async function migrateFeedsFromLocalStorage(): Promise<boolean> {
  try {
    const filePath = getConfigFilePath(FEEDS_FILE)
    const file = Bun.file(filePath)
    if (await file.exists()) return false // Already migrated

    if (typeof localStorage === "undefined") return false

    const raw = localStorage.getItem("podtui_feeds")
    if (!raw) return false

    const feeds = JSON.parse(raw) as Feed[]
    if (!Array.isArray(feeds) || feeds.length === 0) return false

    await saveFeedsToFile(feeds)
    return true
  } catch {
    return false
  }
}

/**
 * Migrate sources from localStorage to file.
 */
export async function migrateSourcesFromLocalStorage(): Promise<boolean> {
  try {
    const filePath = getConfigFilePath(SOURCES_FILE)
    const file = Bun.file(filePath)
    if (await file.exists()) return false

    if (typeof localStorage === "undefined") return false

    const raw = localStorage.getItem("podtui_sources")
    if (!raw) return false

    const sources = JSON.parse(raw)
    if (!Array.isArray(sources) || sources.length === 0) return false

    await saveSourcesToFile(sources)
    return true
  } catch {
    return false
  }
}
