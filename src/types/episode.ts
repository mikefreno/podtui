/**
 * Episode type definitions for PodTUI
 */

/** Episode playback status */
export enum EpisodeStatus {
  NOT_STARTED = "not_started",
  PLAYING = "playing",
  PAUSED = "paused",
  COMPLETED = "completed",
}

/** Core episode information */
export interface Episode {
  /** Unique identifier */
  id: string
  /** Parent podcast ID */
  podcastId: string
  /** Episode title */
  title: string
  /** Episode description/show notes */
  description: string
  /** Audio file URL */
  audioUrl: string
  /** Duration in seconds */
  duration: number
  /** Publication date */
  pubDate: Date
  /** Episode number (if available) */
  episodeNumber?: number
  /** Season number (if available) */
  seasonNumber?: number
  /** Episode type (full, trailer, bonus) */
  episodeType?: EpisodeType
  /** Whether episode is explicit */
  explicit?: boolean
  /** Episode image URL (if different from podcast) */
  imageUrl?: string
  /** File size in bytes */
  fileSize?: number
  /** MIME type */
  mimeType?: string
}

/** Episode type enumeration */
export enum EpisodeType {
  FULL = "full",
  TRAILER = "trailer",
  BONUS = "bonus",
}

/** Episode playback progress */
export interface Progress {
  /** Episode ID */
  episodeId: string
  /** Current position in seconds */
  position: number
  /** Total duration in seconds */
  duration: number
  /** Last played timestamp */
  timestamp: Date
  /** Playback speed (1.0 = normal) */
  playbackSpeed?: number
}

/** Episode with playback state */
export interface EpisodeWithProgress extends Episode {
  /** Current playback status */
  status: EpisodeStatus
  /** Playback progress */
  progress?: Progress
}

/** Episode list item for display */
export interface EpisodeListItem {
  /** Episode data */
  episode: Episode
  /** Podcast title (for display in feeds) */
  podcastTitle: string
  /** Podcast cover URL */
  podcastCoverUrl?: string
  /** Current status */
  status: EpisodeStatus
  /** Progress percentage (0-100) */
  progressPercent: number
}
