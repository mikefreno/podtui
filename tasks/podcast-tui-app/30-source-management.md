# 29. Build Feed List Component (Public/Private Feeds)

meta:
  id: podcast-tui-app-29
  feature: podcast-tui-app
  priority: P0
  depends_on: [28]
  tags: [feed-list, components, solidjs, opentui]

objective:
- Create a scrollable feed list component
- Display public and private feeds
- Implement feed selection and display
- Add reverse chronological ordering

deliverables:
- `src/components/FeedList.tsx` with feed list component
- `src/components/FeedItem.tsx` with individual feed item
- `src/components/FeedFilter.tsx` with public/private toggle

steps:
- Create `src/components/FeedList.tsx`:
  - Use `<scrollbox>` for scrollable list
  - Accept feeds array as prop
  - Implement feed rendering with `createSignal` for selection
  - Add keyboard navigation (arrow keys, enter)
  - Display feed title, description, episode count
- Create `src/components/FeedItem.tsx`:
  - Display feed information
  - Show public/private indicator
  - Highlight selected feed
  - Add hover effects
- Create `src/components/FeedFilter.tsx`:
  - Toggle button for public/private feeds
  - Filter logic implementation
  - Update parent FeedList when filtered
- Add feed list to "My Feeds" navigation tab

tests:
- Unit: Test FeedList renders with feeds
- Unit: Test FeedItem displays correctly
- Integration: Test public/private filtering
- Integration: Test keyboard navigation in feed list

acceptance_criteria:
- Feed list displays all feeds correctly
- Public/private toggle filters feeds
- Feed selection is visually indicated
- Keyboard navigation works (arrow keys, enter)
- List scrolls properly when many feeds

validation:
- Run application and navigate to "My Feeds"
- Add some feeds and verify they appear
- Test public/private toggle
- Use arrow keys to navigate feeds
- Scroll list with many feeds

notes:
- Use SolidJS `createSignal` for selection state
- Follow OpenTUI component patterns from `components/REFERENCE.md`
- Feed list should be scrollable with many items
- Use Flexbox for layout
