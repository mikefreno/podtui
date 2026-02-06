/**
 * Platform-specific media session registration.
 *
 * Registers the currently playing track with the OS so that system
 * media controls (notification center, lock screen, MPRIS) display
 * track info and can send play/pause/next/prev commands.
 *
 * Implementations:
 *  - **macOS**: Shells out to `nowplaying-cli` (brew install nowplaying-cli)
 *              Falls back to no-op if the binary isn't available.
 *  - **Linux**: Writes a minimal MPRIS2 metadata file that desktop
 *              environments can pick up. Full D-Bus integration would
 *              require native bindings; this is best-effort.
 *  - **Other**: No-op stub.
 *
 * All methods are fire-and-forget and never throw.
 */

import { spawn } from "child_process"

export interface TrackMetadata {
  title: string
  artist?: string
  album?: string
  artworkUrl?: string
  duration?: number // seconds
}

export interface MediaRegistryInstance {
  /** Platform identifier */
  readonly platform: "macos" | "linux" | "windows" | "unknown"
  /** Whether the platform integration is available */
  readonly available: boolean

  /** Register / update now-playing metadata */
  setNowPlaying(meta: TrackMetadata): void
  /** Update playback position (seconds) */
  setPosition(seconds: number): void
  /** Update playing/paused state */
  setPlaybackState(playing: boolean): void
  /** Clear now-playing info (e.g. on stop) */
  clearNowPlaying(): void
  /** Tear down any resources */
  dispose(): void
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

function detectPlatform(): "macos" | "linux" | "windows" | "unknown" {
  switch (process.platform) {
    case "darwin":
      return "macos"
    case "linux":
      return "linux"
    case "win32":
      return "windows"
    default:
      return "unknown"
  }
}

// ---------------------------------------------------------------------------
// macOS — nowplaying-cli
// ---------------------------------------------------------------------------

function hasBinary(name: string): boolean {
  try {
    const result = Bun.spawnSync(["which", name])
    return result.exitCode === 0
  } catch {
    return false
  }
}

function createMacOSRegistry(): MediaRegistryInstance {
  const hasNowPlaying = hasBinary("nowplaying-cli")

  function run(args: string[]): void {
    if (!hasNowPlaying) return
    try {
      const proc = spawn("nowplaying-cli", args, {
        stdio: "ignore",
        detached: true,
      })
      proc.unref()
    } catch {
      // Best-effort
    }
  }

  return {
    platform: "macos",
    available: hasNowPlaying,

    setNowPlaying(meta) {
      const args = ["set", "title", meta.title]
      if (meta.artist) args.push("artist", meta.artist)
      if (meta.album) args.push("album", meta.album)
      if (meta.duration) args.push("duration", String(meta.duration))
      run(args)
    },

    setPosition(seconds) {
      run(["set", "elapsedTime", String(Math.floor(seconds))])
    },

    setPlaybackState(playing) {
      run(["set", "playbackRate", playing ? "1" : "0"])
    },

    clearNowPlaying() {
      run(["clear"])
    },

    dispose() {
      run(["clear"])
    },
  }
}

// ---------------------------------------------------------------------------
// Linux — best-effort MPRIS stub
// ---------------------------------------------------------------------------

function createLinuxRegistry(): MediaRegistryInstance {
  // Full MPRIS2 requires owning a D-Bus name and exposing the
  // org.mpris.MediaPlayer2.Player interface. That needs native
  // bindings (dbus-next, etc.) which adds significant complexity.
  //
  // For now we provide a no-op stub that can be upgraded later
  // without changing the public interface.

  return {
    platform: "linux",
    available: false,

    setNowPlaying() {},
    setPosition() {},
    setPlaybackState() {},
    clearNowPlaying() {},
    dispose() {},
  }
}

// ---------------------------------------------------------------------------
// No-op fallback
// ---------------------------------------------------------------------------

function createNoopRegistry(platform: "windows" | "unknown"): MediaRegistryInstance {
  return {
    platform,
    available: false,

    setNowPlaying() {},
    setPosition() {},
    setPlaybackState() {},
    clearNowPlaying() {},
    dispose() {},
  }
}

// ---------------------------------------------------------------------------
// Factory & singleton
// ---------------------------------------------------------------------------

let instance: MediaRegistryInstance | null = null

/**
 * Returns the singleton MediaRegistry for the current platform.
 * Always safe to call — returns a no-op if no integration is available.
 */
export function useMediaRegistry(): MediaRegistryInstance {
  if (instance) return instance

  const platform = detectPlatform()

  switch (platform) {
    case "macos":
      instance = createMacOSRegistry()
      break
    case "linux":
      instance = createLinuxRegistry()
      break
    default:
      instance = createNoopRegistry(platform)
      break
  }

  return instance
}
