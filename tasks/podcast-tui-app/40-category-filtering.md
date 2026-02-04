# 39. Add Trending Shows Display

meta:
  id: podcast-tui-app-39
  feature: podcast-tui-app
  priority: P1
  depends_on: [38]
  tags: [trending-shows, display, solidjs]

objective:
- Display trending shows section
- Show top podcasts by popularity
- Implement trend indicators
- Display show rankings

deliverables:
- `src/components/TrendingShows.tsx` with trending section
- `src/components/ShowRanking.tsx` with ranking display
- `src/components/TrendIndicator.tsx` with trend icon

steps:
- Create `src/components/TrendingShows.tsx`:
  - Trending section header
  - Top shows list
  - Show ranking (1, 2, 3...)
  - Trending indicator
  - Add to feed button
- Create `src/components/ShowRanking.tsx`:
  - Display ranking number
  - Show cover image
  - Show title
  - Trending score display
- Create `src/components/TrendIndicator.tsx`:
  - Display trend icon (up arrow, down arrow, flat)
  - Color-coded for trend direction
  - Show trend percentage
- Add trending section to Discover page

tests:
- Unit: Test TrendingShows displays correctly
- Unit: Test ranking display
- Unit: Test trend indicator

acceptance_criteria:
- Trending shows section displays correctly
- Rankings shown for top shows
- Trend indicators display correctly
- Add to feed buttons work

validation:
- Run application and navigate to "Discover"
- View trending shows section
- Check rankings and indicators
- Test add to feed

notes:
- Trending shows: Top 10 podcasts
- Trending score: Based on downloads, listens, or engagement
- Trend indicators: Up/down/flat arrows
- Color-coded: Green for up, red for down, gray for flat
- Update trend scores periodically
