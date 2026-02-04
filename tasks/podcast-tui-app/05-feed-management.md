# 05. Create Feed Data Models and Types

meta:
  id: podcast-tui-app-05
  feature: podcast-tui-app
  priority: P0
  depends_on: [04]
  tags: [types, data-models, solidjs, typescript]

objective:
- Define TypeScript interfaces for all podcast-related data types
- Create models for feeds, episodes, sources, and user preferences
- Set up type definitions for sync functionality

deliverables:
- `src/types/podcast.ts` with all data models
- `src/types/episode.ts` with episode-specific types
- `src/types/source.ts` with podcast source types
- `src/types/preference.ts` with user preference types

steps:
- Create `src/types/podcast.ts` with core types:
  - `Podcast` interface (id, title, description, coverUrl, feedUrl, lastUpdated)
  - `Episode` interface (id, title, description, audioUrl, duration, pubDate, episodeNumber)
  - `Feed` interface (id, podcast, episodes[], isPublic, sourceId)
  - `FeedItem` interface (represents a single episode in a feed)
- Create `src/types/episode.ts` with episode types:
  - `Episode` interface
  - `EpisodeStatus` enum (playing, paused, completed)
  - `Progress` interface (episodeId, position, duration)
- Create `src/types/source.ts` with source types:
  - `PodcastSource` interface (id, name, baseUrl, type, apiKey)
  - `SourceType` enum (rss, api, custom)
  - `SearchQuery` interface (query, sourceIds, filters)
- Create `src/types/preference.ts` with preference types:
  - `UserPreference` interface (theme, fontSize, playbackSpeed, autoDownload)
  - `SyncPreference` interface (autoSync, backupInterval, syncMethod)
- Add type exports in `src/index.ts`

tests:
- Unit: Verify all interfaces compile correctly
- Unit: Test enum values are correct
- Integration: Test type definitions match expected data structures

acceptance_criteria:
- All TypeScript interfaces compile without errors
- Types are exported for use across the application
- Type definitions cover all podcast-related data

validation:
- Run `bun run build` to verify TypeScript compilation
- Check `src/types/` directory contains all required files

notes:
- Use strict TypeScript mode
- Include JSDoc comments for complex types
- Keep types simple and focused
- Ensure types are compatible with sync JSON/XML formats
