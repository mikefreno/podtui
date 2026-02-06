/**
 * Episode progress store for PodTUI
 *
 * Persists per-episode playback progress to localStorage.
 * Tracks position, duration, completion, and last-played timestamp.
 */

import { createSignal } from "solid-js"
import type { Progress } from "../types/episode"

const STORAGE_KEY = "podtui_progress"

/** Threshold (fraction 0-1) at which an episode is considered completed */
const COMPLETION_THRESHOLD = 0.95

/** Minimum seconds of progress before persisting */
const MIN_POSITION_TO_SAVE = 5

// --- localStorage helpers ---

function loadProgress(): Record<string, Progress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Record<string, Progress> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const p = value as Record<string, unknown>
      result[key] = {
        episodeId: p.episodeId as string,
        position: p.position as number,
        duration: p.duration as number,
        timestamp: new Date(p.timestamp as string),
        playbackSpeed: p.playbackSpeed as number | undefined,
      }
    }
    return result
  } catch {
    return {}
  }
}

function saveProgress(data: Record<string, Progress>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Quota exceeded or unavailable — silently ignore
  }
}

// --- Singleton store ---

const [progressMap, setProgressMap] = createSignal<Record<string, Progress>>(
  loadProgress(),
)

function persist(): void {
  saveProgress(progressMap())
}

function createProgressStore() {
  return {
    /**
     * Get progress for a specific episode.
     */
    get(episodeId: string): Progress | undefined {
      return progressMap()[episodeId]
    },

    /**
     * Get all progress entries.
     */
    all(): Record<string, Progress> {
      return progressMap()
    },

    /**
     * Update progress for an episode. Only persists if position is meaningful.
     */
    update(
      episodeId: string,
      position: number,
      duration: number,
      playbackSpeed?: number,
    ): void {
      if (position < MIN_POSITION_TO_SAVE && duration > 0) return

      setProgressMap((prev) => ({
        ...prev,
        [episodeId]: {
          episodeId,
          position,
          duration,
          timestamp: new Date(),
          playbackSpeed,
        },
      }))
      persist()
    },

    /**
     * Check if an episode is completed.
     */
    isCompleted(episodeId: string): boolean {
      const p = progressMap()[episodeId]
      if (!p || p.duration <= 0) return false
      return p.position / p.duration >= COMPLETION_THRESHOLD
    },

    /**
     * Get progress percentage (0-100) for an episode.
     */
    getPercent(episodeId: string): number {
      const p = progressMap()[episodeId]
      if (!p || p.duration <= 0) return 0
      return Math.min(100, Math.round((p.position / p.duration) * 100))
    },

    /**
     * Mark an episode as completed (set position to duration).
     */
    markCompleted(episodeId: string): void {
      const p = progressMap()[episodeId]
      const duration = p?.duration ?? 0
      setProgressMap((prev) => ({
        ...prev,
        [episodeId]: {
          episodeId,
          position: duration,
          duration,
          timestamp: new Date(),
          playbackSpeed: p?.playbackSpeed,
        },
      }))
      persist()
    },

    /**
     * Remove progress for an episode (e.g. "mark as new").
     */
    remove(episodeId: string): void {
      setProgressMap((prev) => {
        const next = { ...prev }
        delete next[episodeId]
        return next
      })
      persist()
    },

    /**
     * Clear all progress data.
     */
    clear(): void {
      setProgressMap({})
      persist()
    },
  }
}

// Singleton instance
let instance: ReturnType<typeof createProgressStore> | null = null

export function useProgressStore() {
  if (!instance) {
    instance = createProgressStore()
  }
  return instance
}
