# 35. Add Search Results Display

meta:
  id: podcast-tui-app-35
  feature: podcast-tui-app
  priority: P1
  depends_on: [34]
  tags: [search-results, display, solidjs, opentui]

objective:
- Display search results with rich information
- Show podcast/episode details
- Add to feed functionality
- Keyboard navigation through results

deliverables:
- `src/components/SearchResults.tsx` with results display
- `src/components/ResultCard.tsx` with individual result
- `src/components/ResultDetail.tsx` with detailed view

steps:
- Create `src/components/ResultCard.tsx`:
  - Display result title
  - Display source information
  - Display description/snippet
  - Add to feed button
  - Click to view details
- Create `src/components/ResultDetail.tsx`:
  - Full result details
  - Podcast/episode information
  - Episode list (if podcast)
  - Subscribe button
  - Close button
- Create `src/components/SearchResults.tsx`:
  - Scrollable results list
  - Empty state display
  - Loading state display
  - Error state display
  - Keyboard navigation

tests:
- Unit: Test ResultCard displays correctly
- Unit: Test ResultDetail displays correctly
- Unit: Test search results list
- Integration: Test add to feed

acceptance_criteria:
- Search results display with all information
- Result cards show source and details
- Add to feed button works
- Keyboard navigation works

validation:
- Run application and perform search
- Verify results display correctly
- Click result to view details
- Test add to feed
- Test keyboard navigation

notes:
- Use SolidJS `createSignal` for result selection
- Display result type (podcast/episode)
- Show source name and type
- Add loading state during search
- Handle empty results
- Add pagination for large result sets
