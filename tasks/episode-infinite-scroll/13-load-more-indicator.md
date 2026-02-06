# 13. Add Loading Indicator for Pagination

meta:
  id: episode-infinite-scroll-13
  feature: episode-infinite-scroll
  priority: P3
  depends_on: [episode-infinite-scroll-12]
  tags: [ui, feedback, loading]

objective:
- Display loading indicator when fetching more episodes
- Show loading state in episodes panel
- Hide indicator when pagination complete

deliverables:
- Loading indicator component
- Loading state display logic
- Integration with pagination events

steps:
1. Add loading state to episodes panel state
2. Create loading indicator UI (spinner or text)
3. Display indicator when fetching episodes
4. Hide indicator when pagination complete
5. Test loading state visibility

tests:
- Integration: Test loading indicator during fetch
- Visual: Verify loading state doesn't block interaction
- UX: Test loading state disappears when done

acceptance_criteria:
- Loading indicator displays during fetch
- Indicator is visible but doesn't block scrolling
- Indicator disappears when pagination complete

validation:
- Scroll to bottom and watch loading indicator
- Verify indicator shows/hides correctly
- Test with slow RSS feeds

notes:
- Reuse existing loading indicator pattern from MyShowsPage
- Use spinner or "Loading..." text
- Position indicator at bottom of scrollbox
- Don't block user interaction while loading
