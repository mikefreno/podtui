/**
 * Reactive SolidJS hook wrapping the AudioBackend.
 *
 * Provides signals for playback state and methods for controlling
 * audio. Integrates with the event bus and app store.
 *
 * Usage:
 * ```tsx
 * const audio = useAudio()
 * audio.play(episode)
 * <text>{audio.isPlaying() ? "Playing" : "Paused"}</text>
 * ```
 */

import { createSignal, onCleanup } from "solid-js"
import {
  createAudioBackend,
  detectPlayers,
  type AudioBackend,
  type BackendName,
  type DetectedPlayer,
} from "../utils/audio-player"
import { emit, on } from "../utils/event-bus"
import { useAppStore } from "../stores/app"
import type { Episode } from "../types/episode"

export interface AudioControls {
  // Signals (reactive getters)
  isPlaying: () => boolean
  position: () => number
  duration: () => number
  volume: () => number
  speed: () => number
  backendName: () => BackendName
  error: () => string | null
  currentEpisode: () => Episode | null
  availablePlayers: () => DetectedPlayer[]

  // Actions
  play: (episode: Episode) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  togglePlayback: () => Promise<void>
  stop: () => Promise<void>
  seek: (seconds: number) => Promise<void>
  seekRelative: (delta: number) => Promise<void>
  setVolume: (volume: number) => Promise<void>
  setSpeed: (speed: number) => Promise<void>
  switchBackend: (name: BackendName) => Promise<void>
}

// Singleton state — shared across all components that call useAudio()
let backend: AudioBackend | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let refCount = 0

const [isPlaying, setIsPlaying] = createSignal(false)
const [position, setPosition] = createSignal(0)
const [duration, setDuration] = createSignal(0)
const [volume, setVolume] = createSignal(0.7)
const [speed, setSpeed] = createSignal(1)
const [backendName, setBackendName] = createSignal<BackendName>("none")
const [error, setError] = createSignal<string | null>(null)
const [currentEpisode, setCurrentEpisode] = createSignal<Episode | null>(null)
const [availablePlayers, setAvailablePlayers] = createSignal<DetectedPlayer[]>([])

function ensureBackend(): AudioBackend {
  if (!backend) {
    const detected = detectPlayers()
    setAvailablePlayers(detected)
    backend = createAudioBackend()
    setBackendName(backend.name)
  }
  return backend
}

function startPolling(): void {
  stopPolling()
  pollTimer = setInterval(async () => {
    if (!backend || !isPlaying()) return
    try {
      const pos = await backend.getPosition()
      const dur = await backend.getDuration()
      setPosition(pos)
      if (dur > 0) setDuration(dur)

      // Check if backend stopped playing (track ended)
      if (!backend.isPlaying() && isPlaying()) {
        setIsPlaying(false)
        stopPolling()
      }
    } catch {
      // Backend may have been disposed
    }
  }, 500)
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function play(episode: Episode): Promise<void> {
  const b = ensureBackend()
  setError(null)

  if (!episode.audioUrl) {
    setError("No audio URL for this episode")
    return
  }

  try {
    const appStore = useAppStore()
    const storeSpeed = appStore.state().settings.playbackSpeed
    const vol = volume()
    const spd = storeSpeed || speed()

    await b.play(episode.audioUrl, {
      volume: vol,
      speed: spd,
    })

    setCurrentEpisode(episode)
    setIsPlaying(true)
    setPosition(0)
    setSpeed(spd)
    if (episode.duration) setDuration(episode.duration)

    startPolling()
    emit("player.play", { episodeId: episode.id })
  } catch (err) {
    setError(err instanceof Error ? err.message : "Playback failed")
    setIsPlaying(false)
  }
}

async function pause(): Promise<void> {
  if (!backend) return
  try {
    await backend.pause()
    setIsPlaying(false)
    stopPolling()
    const ep = currentEpisode()
    if (ep) emit("player.pause", { episodeId: ep.id })
  } catch (err) {
    setError(err instanceof Error ? err.message : "Pause failed")
  }
}

async function resume(): Promise<void> {
  if (!backend) return
  try {
    await backend.resume()
    setIsPlaying(true)
    startPolling()
    const ep = currentEpisode()
    if (ep) emit("player.play", { episodeId: ep.id })
  } catch (err) {
    setError(err instanceof Error ? err.message : "Resume failed")
  }
}

async function togglePlayback(): Promise<void> {
  if (isPlaying()) {
    await pause()
  } else if (currentEpisode()) {
    await resume()
  }
}

async function stop(): Promise<void> {
  if (!backend) return
  try {
    await backend.stop()
    setIsPlaying(false)
    setPosition(0)
    setCurrentEpisode(null)
    stopPolling()
    emit("player.stop", {})
  } catch (err) {
    setError(err instanceof Error ? err.message : "Stop failed")
  }
}

async function seek(seconds: number): Promise<void> {
  if (!backend) return
  const clamped = Math.max(0, Math.min(seconds, duration()))
  try {
    await backend.seek(clamped)
    setPosition(clamped)
  } catch (err) {
    setError(err instanceof Error ? err.message : "Seek failed")
  }
}

async function seekRelative(delta: number): Promise<void> {
  await seek(position() + delta)
}

async function doSetVolume(vol: number): Promise<void> {
  const clamped = Math.max(0, Math.min(1, vol))
  if (backend) {
    try {
      await backend.setVolume(clamped)
    } catch {
      // Some backends can't change volume at runtime
    }
  }
  setVolume(clamped)
}

async function doSetSpeed(spd: number): Promise<void> {
  const clamped = Math.max(0.25, Math.min(3, spd))
  if (backend) {
    try {
      await backend.setSpeed(clamped)
    } catch {
      // Some backends can't change speed at runtime
    }
  }
  setSpeed(clamped)

  // Sync back to app store
  try {
    const appStore = useAppStore()
    appStore.updateSettings({ playbackSpeed: clamped })
  } catch {
    // Store may not be available
  }
}

async function switchBackend(name: BackendName): Promise<void> {
  const wasPlaying = isPlaying()
  const ep = currentEpisode()
  const pos = position()
  const vol = volume()
  const spd = speed()

  // Stop current backend
  if (backend) {
    stopPolling()
    backend.dispose()
    backend = null
  }

  // Create new backend
  backend = createAudioBackend(name)
  setBackendName(backend.name)
  setAvailablePlayers(detectPlayers())

  // Resume playback if we were playing
  if (wasPlaying && ep && ep.audioUrl) {
    try {
      await backend.play(ep.audioUrl, {
        startPosition: pos,
        volume: vol,
        speed: spd,
      })
      setIsPlaying(true)
      startPolling()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backend switch failed")
      setIsPlaying(false)
    }
  }
}

/**
 * Reactive audio controls hook.
 *
 * Returns a singleton — all components share the same playback state.
 * Registers event bus listeners and cleans them up with onCleanup.
 */
export function useAudio(): AudioControls {
  // Initialize backend on first use
  ensureBackend()

  // Sync initial speed from app store
  if (refCount === 0) {
    try {
      const appStore = useAppStore()
      const storeSpeed = appStore.state().settings.playbackSpeed
      if (storeSpeed && storeSpeed !== speed()) {
        setSpeed(storeSpeed)
      }
    } catch {
      // Store may not be available yet
    }
  }

  refCount++

  // Listen for event bus commands (e.g. from other components)
  const unsubPlay = on("player.play", async (data) => {
    // External play requests — currently just tracks episodeId.
    // Episode lookup would require feed store integration.
  })

  const unsubStop = on("player.stop", async () => {
    if (backend && isPlaying()) {
      await backend.stop()
      setIsPlaying(false)
      setPosition(0)
      setCurrentEpisode(null)
      stopPolling()
    }
  })

  onCleanup(() => {
    refCount--
    unsubPlay()
    unsubStop()

    if (refCount <= 0) {
      stopPolling()
      if (backend) {
        backend.dispose()
        backend = null
      }
      refCount = 0
    }
  })

  return {
    isPlaying,
    position,
    duration,
    volume,
    speed,
    backendName,
    error,
    currentEpisode,
    availablePlayers,

    play,
    pause,
    resume,
    togglePlayback,
    stop,
    seek,
    seekRelative,
    setVolume: doSetVolume,
    setSpeed: doSetSpeed,
    switchBackend,
  }
}
