/**
 * Podcast source type definitions for PodTUI
 */

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
  /** API key (if required) */
  apiKey?: string
  /** Whether source is enabled */
  enabled: boolean
  /** Source icon/logo URL */
  iconUrl?: string
  /** Source description */
  description?: string
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

/** Search result */
export interface SearchResult {
  /** Source that returned this result */
  sourceId: string
  /** Podcast data */
  podcast: import("./podcast").Podcast
  /** Relevance score (0-1) */
  score?: number
}

/** Default podcast sources */
export const DEFAULT_SOURCES: PodcastSource[] = [
  {
    id: "itunes",
    name: "Apple Podcasts",
    type: SourceType.API,
    baseUrl: "https://itunes.apple.com/search",
    enabled: true,
    description: "Search the Apple Podcasts directory",
  },
  {
    id: "rss",
    name: "RSS Feed",
    type: SourceType.RSS,
    baseUrl: "",
    enabled: true,
    description: "Add podcasts via RSS feed URL",
  },
]
