# 07. Implement Multi-Source Search Interface

meta:
  id: podcast-tui-app-07
  feature: podcast-tui-app
  priority: P1
  depends_on: [06]
  tags: [search, multi-source, solidjs, opentui]

objective:
- Create search input component
- Implement multi-source search functionality
- Display search results with sources
- Add search history with persistent storage

deliverables:
- `src/components/SearchBar.tsx` with search input
- `src/components/SearchResults.tsx` with results display
- `src/components/SearchHistory.tsx` with history list
- `src/utils/search.ts` with search logic

steps:
- Create `src/components/SearchBar.tsx`:
  - Search input field using `<input>` component
  - Search button
  - Clear history button
  - Enter key handler
- Create `src/utils/search.ts`:
  - `searchPodcasts(query: string, sourceIds: string[]): Promise<Podcast[]>`
  - `searchEpisodes(query: string, feedId: string): Promise<Episode[]>`
  - Handle multiple sources
  - Cache search results
- Create `src/components/SearchResults.tsx`:
  - Display search results with source indicators
  - Show podcast/episode info
  - Add click to add to feeds
  - Keyboard navigation through results
- Create `src/components/SearchHistory.tsx`:
  - Display recent search queries
  - Click to re-run search
  - Delete individual history items
  - Persist to localStorage

tests:
- Unit: Test search logic returns correct results
- Unit: Test search history persistence
- Integration: Test search bar accepts input
- Integration: Test results display correctly

acceptance_criteria:
- Search bar accepts and processes queries
- Multi-source search works across all enabled sources
- Search results display with source information
- Search history persists across sessions
- Keyboard navigation works in results

validation:
- Run application and navigate to "Search"
- Type a query and press Enter
- Verify results appear
- Click a result to add to feed
- Restart app and verify history persists

notes:
- Use localStorage for search history
- Implement basic caching to avoid repeated searches
- Handle empty results gracefully
- Add loading state during search
