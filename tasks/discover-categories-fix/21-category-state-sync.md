# 21. Fix Category State Synchronization

meta:
  id: discover-categories-fix-21
  feature: discover-categories-fix
  priority: P2
  depends_on: [discover-categories-fix-20]
  tags: [state-management, discover, categories]

objective:
- Ensure category state is properly synchronized across components
- Fix state updates not triggering re-renders
- Ensure category selection persists correctly

deliverables:
- Fixed state synchronization logic
- Updated category selection handlers
- Verified state propagation

steps:
1. Fix category state update handlers in DiscoverPage
2. Ensure discoverStore.setSelectedCategory() is called correctly
3. Fix signal updates to trigger component re-renders
4. Test state synchronization across component updates
5. Verify category state persists on navigation

tests:
- Unit: Test state update handlers
- Integration: Test category selection and state updates
- Manual: Navigate between tabs and verify category state

acceptance_criteria:
- Category state updates propagate correctly
- Component re-renders when category changes
- Category selection persists across navigation

validation:
- Select category and verify show list updates
- Switch tabs and back, verify category still selected
- Test category navigation with keyboard

notes:
- Check if signals are properly created and updated
- Verify discoverStore state is reactive
- Ensure CategoryFilter and TrendingShows receive updated data
- Test with multiple category selections
- Add state persistence if needed
