# 33. Create Search Interface

meta:
  id: podcast-tui-app-33
  feature: podcast-tui-app
  priority: P1
  depends_on: [32]
  tags: [search-interface, input, solidjs, opentui]

objective:
- Create search input component
- Implement search functionality
- Display search results
- Handle search state

deliverables:
- `src/components/SearchBar.tsx` with search input
- `src/components/SearchResults.tsx` with results display
- `src/components/SearchHistory.tsx` with history list

steps:
- Create `src/components/SearchBar.tsx`:
  - Search input field using `<input>` component
  - Search button
  - Clear button
  - Enter key handler
  - Loading state
- Create `src/utils/search.ts`:
  - `searchPodcasts(query: string, sourceIds: string[]): Promise<Podcast[]>`
  - `searchEpisodes(query: string, feedId: string): Promise<Episode[]>`
  - Handle multiple sources
  - Cache search results
- Create `src/components/SearchResults.tsx`:
  - Display search results with source indicators
  - Show podcast/episode info
  - Add to feed button
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
- Search both podcasts and episodes
