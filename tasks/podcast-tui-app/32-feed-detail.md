# 31. Add Reverse Chronological Ordering

meta:
  id: podcast-tui-app-31
  feature: podcast-tui-app
  priority: P1
  depends_on: [30]
  tags: [ordering, feeds, episodes, solidjs, sorting]

objective:
- Implement reverse chronological ordering for feeds
- Order episodes by publication date (newest first)
- Order feeds by last updated (newest first)
- Provide sort option toggle

deliverables:
- `src/utils/ordering.ts` with sorting functions
- `src/components/FeedSortToggle.tsx` with sort option
- `src/components/EpisodeList.tsx` with ordered episode list

steps:
- Create `src/utils/ordering.ts`:
  - `orderEpisodesByDate(episodes: Episode[]): Episode[]`
  - Order by pubDate descending
  - Handle missing dates
  - `orderFeedsByDate(feeds: Feed[]): Feed[]`
  - Order by lastUpdated descending
  - Handle missing updates
- Create `src/components/FeedSortToggle.tsx`:
  - Toggle button for date ordering
  - Display current sort order
  - Update parent component
- Create `src/components/EpisodeList.tsx`:
  - Accept episodes array
  - Apply ordering
  - Display episodes in reverse chronological order
  - Add keyboard navigation

tests:
- Unit: Test episode ordering
- Unit: Test feed ordering
- Unit: Test sort toggle

acceptance_criteria:
- Episodes ordered by date (newest first)
- Feeds ordered by last updated (newest first)
- Sort toggle works correctly
- Ordering persists across sessions

validation:
- Run application and check episode order
- Check feed order
- Toggle sort order
- Restart app and verify ordering persists

notes:
- Use JavaScript `sort()` with date comparison
- Handle timezone differences
- Add loading state during sort
- Cache ordered results
- Consider adding custom sort options
