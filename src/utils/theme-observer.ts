/**
 * Theme observer utility for detecting and responding to theme changes.
 *
 * This module provides utilities for:
 * - Listening to SIGUSR2 signals for theme reload
 * - Emitting theme change events via the event bus
 * - Tracking theme change state
 */

import { emit } from "./event-bus"

function emitThemeReload(): void {
  emit("theme.reload", {})
}

export function emitThemeChanged(theme: string, mode: "dark" | "light"): void {
  emit("theme.changed", { theme, mode })
}

export function emitThemeModeChanged(mode: "dark" | "light"): void {
  emit("theme.mode.changed", { mode })
}

/**
 * Setup SIGUSR2 signal handler for theme reload.
 * This allows external tools to trigger a theme refresh by sending SIGUSR2 to the process.
 *
 * Usage: `kill -USR2 <pid>` to trigger a theme reload
 *
 * @param onReload - Callback to execute when SIGUSR2 is received
 * @returns Cleanup function to remove the handler
 */
export function setupThemeSignalHandler(onReload: () => void): () => void {
  const handler = () => {
    emitThemeReload()
    onReload()
  }

  process.on("SIGUSR2", handler)

  return () => {
    process.off("SIGUSR2", handler)
  }
}
