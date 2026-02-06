# 12. Manage Episode List Pagination State

meta:
  id: episode-infinite-scroll-12
  feature: episode-infinite-scroll
  priority: P2
  depends_on: [episode-infinite-scroll-11]
  tags: [state-management, pagination]

objective:
- Track pagination state (current page, loaded count, has more episodes)
- Manage episode list state changes
- Handle pagination state across component renders

deliverables:
- Pagination state in feed store
- Episode list state management
- Integration with scroll events

steps:
1. Add pagination state to feed store (currentPage, loadedCount, hasMore)
2. Update episode list when new episodes are loaded
3. Manage loading state for pagination
4. Handle empty episode list case
5. Test pagination state transitions

tests:
- Unit: Test pagination state updates
- Integration: Test state transitions with scroll
- Edge case: Test with no episodes in feed

acceptance_criteria:
- Pagination state accurately tracks loaded episodes
- Episode list updates correctly with new episodes
- Loading state properly managed

validation:
- Load episodes and verify state updates
- Scroll to bottom and verify pagination triggers
- Test with feed having many episodes

notes:
- Use existing feed store from `src/stores/feed.ts`
- Add pagination state to Feed interface
- Consider loading indicator visibility
- Handle rapid scroll events gracefully
