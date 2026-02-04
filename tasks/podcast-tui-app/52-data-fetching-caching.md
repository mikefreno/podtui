# 51. Implement API Client for Podcast Sources

meta:
  id: podcast-tui-app-51
  feature: podcast-tui-app
  priority: P1
  depends_on: [50]
  tags: [api-client, sources, solidjs]

objective:
- Create API client for podcast sources
- Handle RSS feed parsing
- Handle API source queries
- Handle custom sources
- Implement error handling

deliverables:
- `src/api/client.ts` with API client
- `src/api/rss-parser.ts` with RSS parsing
- `src/api/source-handler.ts` with source-specific handlers

steps:
- Create `src/api/client.ts`:
  - `fetchFeeds(sourceIds: string[]): Promise<Feed[]>`
  - `fetchEpisodes(feedUrl: string): Promise<Episode[]>`
  - `searchPodcasts(query: string): Promise<Podcast[]>`
  - Handle API calls and errors
- Create `src/api/rss-parser.ts`:
  - `parseRSSFeed(xml: string): Podcast`
  - Parse RSS XML
  - Extract podcast metadata
  - Extract episodes
- Create `src/api/source-handler.ts`:
  - `handleRSSSource(source: PodcastSource): Promise<Feed[]>`
  - `handleAPISource(source: PodcastSource, query: string): Promise<Podcast[]>`
  - `handleCustomSource(source: PodcastSource, query: string): Promise<Podcast[]>`
  - Source-specific logic

tests:
- Unit: Test RSS parsing
- Unit: Test API client
- Unit: Test source handlers
- Integration: Test API calls

acceptance_criteria:
- API client fetches data correctly
- RSS parsing works
- Source handlers work for all types
- Errors handled gracefully

validation:
- Run application and test API calls
- Test RSS feed parsing
- Test API source queries
- Test error handling

notes:
- Use `feed-parser` library for RSS parsing
- Use `axios` for API calls
- Handle rate limiting
- Cache API responses
- Add error handling for failed requests
- Store API keys securely
