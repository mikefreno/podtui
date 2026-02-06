/**
 * Config file backup utility for PodTUI
 *
 * Creates timestamped backups of config files before updates.
 * Keeps the most recent N backups and cleans up older ones.
 */

import { readdir, unlink } from "fs/promises"
import path from "path"
import { getConfigDir, ensureConfigDir } from "./config-dir"

/** Maximum number of backup files to keep per config file */
const MAX_BACKUPS = 5

/**
 * Generate a timestamped backup filename.
 * Example: feeds.json -> feeds.json.2026-02-05T120000.backup
 */
function backupFilename(originalName: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)
  return `${originalName}.${ts}.backup`
}

/**
 * Create a backup of a config file before overwriting it.
 * No-op if the source file does not exist.
 */
export async function backupConfigFile(filename: string): Promise<boolean> {
  try {
    await ensureConfigDir()
    const dir = getConfigDir()
    const srcPath = path.join(dir, filename)
    const srcFile = Bun.file(srcPath)

    if (!(await srcFile.exists())) return false

    const content = await srcFile.text()
    if (!content || content.trim().length === 0) return false

    const backupName = backupFilename(filename)
    const backupPath = path.join(dir, backupName)
    await Bun.write(backupPath, content)

    // Clean up old backups
    await pruneBackups(filename)

    return true
  } catch {
    return false
  }
}

/**
 * Keep only the most recent MAX_BACKUPS backup files for a given config file.
 */
async function pruneBackups(filename: string): Promise<void> {
  try {
    const dir = getConfigDir()
    const entries = await readdir(dir)

    // Match pattern: filename.*.backup
    const prefix = `${filename}.`
    const suffix = ".backup"
    const backups = entries
      .filter((e) => e.startsWith(prefix) && e.endsWith(suffix))
      .sort() // Lexicographic sort works because timestamps are ISO-like

    if (backups.length <= MAX_BACKUPS) return

    const toRemove = backups.slice(0, backups.length - MAX_BACKUPS)
    for (const name of toRemove) {
      await unlink(path.join(dir, name)).catch(() => {})
    }
  } catch {
    // Silently ignore cleanup errors
  }
}

/**
 * List existing backup files for a given config file, newest first.
 */
export async function listBackups(filename: string): Promise<string[]> {
  try {
    const dir = getConfigDir()
    const entries = await readdir(dir)

    const prefix = `${filename}.`
    const suffix = ".backup"
    return entries
      .filter((e) => e.startsWith(prefix) && e.endsWith(suffix))
      .sort()
      .reverse()
  } catch {
    return []
  }
}
