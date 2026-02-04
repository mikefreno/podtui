# 28. Create Feed Data Models and Types

meta:
  id: podcast-tui-app-28
  feature: podcast-tui-app
  priority: P0
  depends_on: [27]
  tags: [types, data-models, solidjs, typescript]

objective:
- Define TypeScript interfaces for all podcast-related data
- Create models for feeds, episodes, sources
- Set up type definitions for sync functionality

deliverables:
- `src/types/podcast.ts` with core types
- `src/types/episode.ts` with episode types
- `src/types/source.ts` with source types
- `src/types/feed.ts` with feed types

steps:
- Create `src/types/podcast.ts`:
  - `Podcast` interface (id, title, description, coverUrl, feedUrl, lastUpdated)
  - `PodcastWithEpisodes` interface (podcast + episodes array)
- Create `src/types/episode.ts`:
  - `Episode` interface (id, title, description, audioUrl, duration, pubDate, episodeNumber)
  - `EpisodeStatus` enum (playing, paused, completed, not_started)
  - `Progress` interface (episodeId, position, duration, timestamp)
- Create `src/types/source.ts`:
  - `PodcastSource` interface (id, name, baseUrl, type, apiKey, enabled)
  - `SourceType` enum (rss, api, custom)
  - `SearchQuery` interface (query, sourceIds, filters)
- Create `src/types/feed.ts`:
  - `Feed` interface (id, podcast, episodes[], isPublic, sourceId, lastUpdated)
  - `FeedItem` interface (represents a single episode in a feed)
  - `FeedFilter` interface (public, private, sourceId)

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
