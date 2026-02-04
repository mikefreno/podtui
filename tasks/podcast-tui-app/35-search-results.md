# 34. Implement Multi-Source Search

meta:
  id: podcast-tui-app-34
  feature: podcast-tui-app
  priority: P1
  depends_on: [33]
  tags: [multi-source, search, solidjs, api]

objective:
- Implement search across multiple podcast sources
- Handle different source types (RSS, API, Custom)
- Display source information in results
- Cache search results

deliverables:
- `src/utils/search.ts` with multi-source search logic
- `src/utils/source-searcher.ts` with source-specific searchers
- `src/components/SourceBadge.tsx` with source indicator

steps:
- Create `src/utils/source-searcher.ts`:
  - `searchRSSSource(query: string, source: PodcastSource): Promise<Podcast[]>`
  - `searchAPISource(query: string, source: PodcastSource): Promise<Podcast[]>`
  - `searchCustomSource(query: string, source: PodcastSource): Promise<Podcast[]>`
  - Handle source-specific search logic
- Create `src/utils/search.ts`:
  - `searchPodcasts(query: string, sourceIds: string[]): Promise<Podcast[]>`
  - Aggregate results from multiple sources
  - Deduplicate results
  - Cache results by query
  - Handle source errors gracefully
- Create `src/components/SourceBadge.tsx`:
  - Display source type (RSS, API, Custom)
  - Show source name
  - Color-coded for different types

tests:
- Unit: Test RSS source search
- Unit: Test API source search
- Unit: Test custom source search
- Unit: Test result aggregation

acceptance_criteria:
- Search works across all enabled sources
- Source information displayed correctly
- Results aggregated from multiple sources
- Errors handled gracefully

validation:
- Run application and perform search
- Verify results from multiple sources
- Test with different source types
- Test error handling for failed sources

notes:
- RSS sources: Parse feed XML
- API sources: Call API endpoints
- Custom sources: User-defined search logic
- Handle rate limiting
- Cache results to avoid repeated searches
- Show loading state for each source
