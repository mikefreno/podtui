/**
 * Podcast source type definitions for PodTUI
 */

import type { Episode } from "./episode"
import type { Podcast } from "./podcast"

/** Source type enumeration */
export enum SourceType {
  /** RSS feed URL */
  RSS = "rss",
  /** API-based source (iTunes, Spotify, etc.) */
  API = "api",
  /** Custom/user-defined source */
  CUSTOM = "custom",
}

/** Podcast source configuration */
export interface PodcastSource {
  /** Unique identifier */
  id: string
  /** Source display name */
  name: string
  /** Source type */
  type: SourceType
  /** Base URL for the source */
  baseUrl: string
  /** API key — live only when the keychain is unavailable and the source
   *  uses the plaintext fallback (credentialStorage "plaintext"). Legacy
   *  plaintext keys are migrated to the OS keychain on load and stripped. */
  apiKey?: string
  /** API secret (e.g. Podcast Index signature auth) — same lifecycle as
   *  apiKey: held in the OS keychain by default, live on the source only
   *  under the plaintext fallback. */
  apiSecret?: string
  /** True when this source's credentials are stored. A source is usable once
   *  enabled. */
  hasCredentials?: boolean
  /** Where this source's credentials live: the OS keychain (encrypted at
   *  rest) by default, or config.json as a plaintext fallback when the
   *  keychain is unavailable (e.g. non-macOS). */
  credentialStorage?: "keychain" | "plaintext"
  /** Whether source is enabled */
  enabled: boolean
  /** Source icon/logo URL */
  iconUrl?: string
  /** Source description */
  description?: string
  /** Default country for source searches */
  country?: string
  /** Default language for search results */
  language?: string
  /** Include explicit results */
  allowExplicit?: boolean
  /** Rate limit (requests per minute) */
  rateLimit?: number
  /** Last successful fetch */
  lastFetch?: Date
}

/** Search query configuration */
export interface SearchQuery {
  /** Search query text */
  query: string
  /** Source IDs to search (empty = all enabled sources) */
  sourceIds: string[]
  /** Optional filters */
  filters?: SearchFilters
}

/** Search filters */
export interface SearchFilters {
  /** Filter by language */
  language?: string
  /** Filter by category */
  category?: string
  /** Filter by explicit content */
  explicit?: boolean
  /** Sort by field */
  sortBy?: SearchSortField
  /** Sort direction */
  sortDirection?: "asc" | "desc"
  /** Results limit */
  limit?: number
  /** Results offset for pagination */
  offset?: number
}

/** Search sort fields */
export enum SearchSortField {
  RELEVANCE = "relevance",
  DATE = "date",
  TITLE = "title",
  POPULARITY = "popularity",
}

/** What a directory search targets: shows or individual episodes. */
export type SearchScope = "podcast" | "episode"

/** Fields shared by every search result. */
export interface SearchResultBase {
  /** Source that returned this result */
  sourceId: string
  /** Source display name */
  sourceName?: string
  /** Source type */
  sourceType?: SourceType
  /** Relevance score (0-1) */
  score?: number
}

/** A show found by directory search. */
export interface PodcastSearchResult extends SearchResultBase {
  kind: "podcast"
  /** Podcast data */
  podcast: Podcast
}

/** A single episode found by directory search. `podcast` is its parent show
 *  — used for display context and for subscribing to the show. */
export interface EpisodeSearchResult extends SearchResultBase {
  kind: "episode"
  podcast: Podcast
  episode: Episode
}

/** Search result */
export type SearchResult = PodcastSearchResult | EpisodeSearchResult

/** Default podcast sources */
export const DEFAULT_SOURCES: PodcastSource[] = [
  {
    id: "itunes",
    name: "Apple Podcasts",
    type: SourceType.API,
    baseUrl: "https://itunes.apple.com/search",
    enabled: true,
    description: "Search the Apple Podcasts directory",
    country: "US",
    language: "en_us",
    allowExplicit: true,
  },
  {
    id: "podcastindex",
    name: "Podcast Index",
    type: SourceType.API,
    baseUrl: "https://api.podcastindex.org/api/1.0/search/byterm",
    enabled: false,
    description:
      "Open podcast directory. Fallback when other sources return few results; requires a free API key + secret from podcastindex.org.",
    language: "en",
    allowExplicit: true,
  },
]
