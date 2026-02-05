/**
 * Theme observer utility for detecting and responding to theme changes.
 *
 * This module provides utilities for:
 * - Listening to SIGUSR2 signals for theme reload
 * - Emitting theme change events via the event bus
 * - Tracking theme change state
 */

import { emit, on, off, type EventHandler } from "./event-bus"

/**
 * Subscribe to theme reload events.
 * These are triggered by SIGUSR2 signals.
 */
export function onThemeReload(handler: EventHandler<{}>): () => void {
  return on("theme.reload", handler)
}

/**
 * Subscribe to theme changed events.
 * These are triggered when the theme selection changes.
 */
export function onThemeChanged(
  handler: EventHandler<{ theme: string; mode: "dark" | "light" }>
): () => void {
  return on("theme.changed", handler)
}

/**
 * Subscribe to theme mode changed events.
 * These are triggered when switching between dark/light mode.
 */
export function onThemeModeChanged(
  handler: EventHandler<{ mode: "dark" | "light" }>
): () => void {
  return on("theme.mode.changed", handler)
}

/**
 * Emit a theme reload event.
 */
export function emitThemeReload(): void {
  emit("theme.reload", {})
}

/**
 * Emit a theme changed event.
 */
export function emitThemeChanged(theme: string, mode: "dark" | "light"): void {
  emit("theme.changed", { theme, mode })
}

/**
 * Emit a theme mode changed event.
 */
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

/**
 * Create a debounced theme change handler to prevent rapid consecutive updates.
 *
 * @param handler - The handler to debounce
 * @param delay - Delay in milliseconds (default: 100ms)
 */
export function createDebouncedThemeHandler<T>(
  handler: (event: T) => void,
  delay: number = 100
): (event: T) => void {
  let timeout: NodeJS.Timeout | null = null

  return (event: T) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      handler(event)
      timeout = null
    }, delay)
  }
}
