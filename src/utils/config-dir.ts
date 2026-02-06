/**
 * XDG_CONFIG_HOME directory setup for PodTUI
 *
 * Handles config directory detection and creation following the XDG Base
 * Directory Specification. Falls back to ~/.config when XDG_CONFIG_HOME
 * is not set.
 */

import { mkdir } from "fs/promises"
import path from "path"

/** Application config directory name */
const APP_DIR_NAME = "podtui"

/** Resolve the XDG_CONFIG_HOME directory, defaulting to ~/.config */
export function getXdgConfigHome(): string {
  const xdg = process.env.XDG_CONFIG_HOME
  if (xdg) return xdg

  const home = process.env.HOME ?? process.env.USERPROFILE ?? ""
  if (!home) throw new Error("Cannot determine home directory")

  return path.join(home, ".config")
}

/** Get the application-specific config directory path */
export function getConfigDir(): string {
  return path.join(getXdgConfigHome(), APP_DIR_NAME)
}

/** Get the path for a specific config file */
export function getConfigFilePath(filename: string): string {
  return path.join(getConfigDir(), filename)
}

/**
 * Ensure the application config directory exists.
 * Creates it recursively if needed.
 */
export async function ensureConfigDir(): Promise<string> {
  const dir = getConfigDir()
  await mkdir(dir, { recursive: true })
  return dir
}

/** Resolve the XDG_DATA_HOME directory, defaulting to ~/.local/share */
export function getXdgDataHome(): string {
  const xdg = process.env.XDG_DATA_HOME
  if (xdg) return xdg

  const home = process.env.HOME ?? process.env.USERPROFILE ?? ""
  if (!home) throw new Error("Cannot determine home directory")

  return path.join(home, ".local", "share")
}

/** Get the application-specific data directory path */
export function getDataDir(): string {
  return path.join(getXdgDataHome(), APP_DIR_NAME)
}

/** Get the downloads directory path */
export function getDownloadsDir(): string {
  return path.join(getDataDir(), "downloads")
}

/** Ensure the downloads directory exists */
export async function ensureDownloadsDir(): Promise<string> {
  const dir = getDownloadsDir()
  await mkdir(dir, { recursive: true })
  return dir
}
