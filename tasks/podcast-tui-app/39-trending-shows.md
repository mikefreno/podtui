# 38. Build Discover Page Component

meta:
  id: podcast-tui-app-38
  feature: podcast-tui-app
  priority: P1
  depends_on: [37]
  tags: [discover-page, popular-shows, solidjs, opentui]

objective:
- Create discover page component
- Display popular shows
- Implement category filtering
- Add to feed functionality

deliverables:
- `src/components/DiscoverPage.tsx` with discover UI
- `src/components/PopularShows.tsx` with shows grid
- `src/components/CategoryFilter.tsx` with category buttons

steps:
- Create `src/components/DiscoverPage.tsx`:
  - Page header with title
  - Category filter buttons
  - Popular shows grid
  - Show details view
  - Add to feed button
- Create `src/components/PopularShows.tsx`:
  - Grid display of popular podcasts
  - Show cover image
  - Show title and description
  - Add to feed button
  - Click to view details
- Create `src/components/CategoryFilter.tsx`:
  - Category button group
  - Active category highlighting
  - Filter logic implementation
  - Update parent DiscoverPage

tests:
- Unit: Test PopularShows displays correctly
- Unit: Test CategoryFilter functionality
- Integration: Test discover page navigation

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
- Use Flexbox for category filter layout
- Use Grid for shows display
- Add loading state if fetching from API
- Handle empty categories
- Add hover effects for interactivity
