# 32. Create Feed Detail View

meta:
  id: podcast-tui-app-32
  feature: podcast-tui-app
  priority: P1
  depends_on: [31]
  tags: [feed-detail, episodes, solidjs, opentui]

objective:
- Create feed detail view component
- Display podcast information
- List episodes in reverse chronological order
- Provide episode playback controls

deliverables:
- `src/components/FeedDetail.tsx` with feed detail view
- `src/components/EpisodeList.tsx` with episode list
- `src/components/EpisodeItem.tsx` with individual episode

steps:
- Create `src/components/FeedDetail.tsx`:
  - Podcast cover image
  - Podcast title and description
  - Episode count
  - Subscribe/unsubscribe button
  - Episode list container
- Create `src/components/EpisodeList.tsx`:
  - Scrollable episode list
  - Display episode title, date, duration
  - Playback status indicator
  - Add keyboard navigation
- Create `src/components/EpisodeItem.tsx`:
  - Episode information
  - Play button
  - Mark as complete button
  - Progress bar
  - Hover effects
- Add feed detail to "My Feeds" navigation tab

tests:
- Unit: Test FeedDetail displays correctly
- Unit: Test EpisodeList rendering
- Unit: Test EpisodeItem interaction
- Integration: Test feed detail navigation

acceptance_criteria:
- Feed detail displays podcast info
- Episode list shows all episodes
- Episodes ordered reverse chronological
- Play buttons work
- Mark as complete works

validation:
- Run application and navigate to feed detail
- View podcast information
- Check episode order
- Test play button
- Test mark as complete

notes:
- Use SolidJS `createSignal` for episode selection
- Display episode status (playing, completed, not started)
- Show progress for completed episodes
- Add episode filtering (all, completed, not completed)
- Use Flexbox for layout
