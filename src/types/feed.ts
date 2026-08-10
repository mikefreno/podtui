/**
 * Feed type definitions for PodTUI
 */

import type { Podcast } from "./podcast"
import type { Episode, EpisodeStatus } from "./episode"

/** Feed visibility */
export enum FeedVisibility {
  PUBLIC = "public",
  PRIVATE = "private",
}

/** Feed information */
export interface Feed {
  /** Unique identifier */
  id: string
  /** Associated podcast */
  podcast: Podcast
  /** Episodes in this feed */
  episodes: Episode[]
  /** Whether feed is public or private */
  visibility: FeedVisibility
  /** Source ID that provided this feed */
  sourceId: string
  /** Last updated timestamp */
  lastUpdated: Date
  /** Custom feed name (user-defined) */
  customName?: string
  /** User notes about this feed */
  notes?: string
  /** Whether feed is pinned/favorited */
  isPinned: boolean
  /** Feed color for UI */
  color?: string
}

/** Feed item for display in lists */
export interface FeedItem {
  /** Episode data */
  episode: Episode
  /** Parent podcast */
  podcast: Podcast
  /** Feed ID */
  feedId: string
  /** Episode status */
  status: EpisodeStatus
  /** Progress percentage (0-100) */
  progressPercent: number
  /** Whether this item is new (unplayed) */
  isNew: boolean
}

/** Feed filter options */
export interface FeedFilter {
  /** Filter by visibility */
  visibility?: FeedVisibility | "all"
  /** Filter by source ID */
  sourceId?: string
  /** Filter by pinned status */
  pinnedOnly?: boolean
  /** Search query for filtering */
  searchQuery?: string
  /** Sort field */
  sortBy?: FeedSortField
  /** Sort direction */
  sortDirection?: "asc" | "desc"
  /** Show private feeds */
  showPrivate?: boolean
}

/** Feed sort fields */
export enum FeedSortField {
  /** Sort by last updated */
  UPDATED = "updated",
  /** Sort by title */
  TITLE = "title",
  /** Sort by episode count */
  EPISODE_COUNT = "episodeCount",
  /** Sort by most recent episode */
  LATEST_EPISODE = "latestEpisode",
}

/** Feed list display options */
export interface FeedListOptions {
  /** Show episode count */
  showEpisodeCount: boolean
  /** Show last updated */
  showLastUpdated: boolean
  /** Show source indicator */
  showSource: boolean
  /** Compact mode */
  compact: boolean
}

/** Feed statistics */
export interface FeedStats {
  /** Total feed count */
  totalFeeds: number
  /** Public feed count */
  publicFeeds: number
  /** Private feed count */
  privateFeeds: number
  /** Total episode count across all feeds */
  totalEpisodes: number
  /** Unplayed episode count */
  unplayedEpisodes: number
  /** In-progress episode count */
  inProgressEpisodes: number
}
