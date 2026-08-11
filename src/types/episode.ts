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

/** Download status for an episode */
export enum DownloadStatus {
  NONE = "none",
  QUEUED = "queued",
  DOWNLOADING = "downloading",
  COMPLETED = "completed",
  FAILED = "failed",
}

/** Metadata for a downloaded episode */
export interface DownloadedEpisode {
  /** Episode ID */
  episodeId: string
  /** Feed ID the episode belongs to. For downloads of shows that aren't
   *  subscribed (search downloads) this is a deterministic synthetic id
   *  ("unsub-<slug>") that also names the file subdirectory. */
  feedId: string
  /** Current download status */
  status: DownloadStatus
  /** Download progress 0-100 */
  progress: number
  /** Absolute path to the downloaded file */
  filePath: string | null
  /** When the download completed */
  downloadedAt: Date | null
  /** Download speed in bytes/sec (while downloading) */
  speed: number
  /** File size in bytes */
  fileSize: number
  /** Error message if failed */
  error: string | null
  /** Episode title, persisted so unsubscribed-show downloads render without
   *  a loaded feed. */
  episodeTitle?: string
  /** Audio URL, persisted so queued downloads survive a restart. */
  audioUrl?: string
  /** Publication date (ISO), for display of unsubscribed-show downloads. */
  pubDate?: string
  /** Show title, kept for downloads whose show isn't subscribed. */
  podcastTitle?: string
  /** The show's RSS feed URL, used to re-classify a download as subscribed
   *  once the user subscribes to its show. */
  podcastFeedUrl?: string
}
