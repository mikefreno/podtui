# 08. Build Discover Feed with Popular Shows

meta:
  id: podcast-tui-app-08
  feature: podcast-tui-app
  priority: P1
  depends_on: [07]
  tags: [discover, popular-shows, solidjs, opentui]

objective:
- Create popular shows data structure
- Build discover page component
- Display trending shows with categories
- Implement category filtering

deliverables:
- `src/data/popular-shows.ts` with trending shows data
- `src/components/DiscoverPage.tsx` with discover UI
- `src/components/CategoryFilter.tsx` with category buttons

steps:
- Create `src/data/popular-shows.ts`:
  - Array of popular podcasts with metadata
  - Categories: Technology, Business, Science, Entertainment
  - Reverse chronological ordering (newest first)
  - Include feed URLs and descriptions
- Create `src/components/DiscoverPage.tsx`:
  - Title header
  - Category filter buttons
  - Grid/list display of popular shows
  - Show details on selection
  - Add to feed button
- Create `src/components/CategoryFilter.tsx`:
  - Category button group
  - Active category highlighting
  - Filter logic implementation
- Add discover page to "Discover" navigation tab

tests:
- Unit: Test popular shows data structure
- Unit: Test category filtering
- Integration: Test discover page displays correctly
- Integration: Test add to feed functionality

acceptance_criteria:
- Discover page displays popular shows
- Category filtering works correctly
- Shows are ordered reverse chronologically
- Clicking a show shows details
- Add to feed button works

validation:
- Run application and navigate to "Discover"
- Verify popular shows appear
- Click different categories
- Click a show and verify details
- Try add to feed

notes:
- Popular shows data can be static or fetched from sources
- If sources don't provide trending, use curated list
- Categories help users find shows by topic
- Use Flexbox for category filter layout
