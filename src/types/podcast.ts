/**
 * Podcast type definitions for PodTUI
 */

/** Core podcast information */
export interface Podcast {
  /** Unique identifier */
  id: string
  /** Podcast title */
  title: string
  /** Podcast description/summary */
  description: string
  /** Cover image URL */
  coverUrl?: string
  /** RSS feed URL. Empty when the directory lists the show without a feed
   *  (e.g. shows delisted from Apple Podcasts); see directoryUrl. */
  feedUrl: string
  /** Directory listing page (e.g. Apple Podcasts) for shows whose feed URL
   *  the directory omits — used to resolve the real feed at subscribe time. */
  directoryUrl?: string
  /** Author/creator name */
  author?: string
  /** Podcast categories */
  categories?: string[]
  /** Language code (e.g., 'en', 'es') */
  language?: string
  /** Website URL */
  websiteUrl?: string
  /** Last updated timestamp */
  lastUpdated: Date
  /** Whether the podcast is currently subscribed */
  isSubscribed: boolean
  /** Callback to toggle feed visibility */
  onToggleVisibility?: (feedId: string) => void
}

/** Podcast with episodes included */
export interface PodcastWithEpisodes extends Podcast {
  /** List of episodes */
  episodes: Episode[]
  /** Total episode count */
  totalEpisodes: number
}

/** Episode import - needed for PodcastWithEpisodes */
import type { Episode } from "./episode"
