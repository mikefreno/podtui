# 22. Fix Category Keyboard Navigation [x]

meta:
  id: discover-categories-fix-22
  feature: discover-categories-fix
  priority: P2
  depends_on: [discover-categories-fix-21]
  tags: [keyboard, navigation, discover]

objective:
- Fix keyboard navigation for categories
- Ensure category selection works with arrow keys
- Fix category index tracking during navigation

deliverables:
- Fixed keyboard navigation handlers
- Updated category index tracking
- Verified navigation works correctly

steps:
1. Review keyboard navigation in DiscoverPage
2. Fix category index signal updates
3. Ensure categoryIndex signal is updated on arrow key presses
4. Test category navigation with arrow keys
5. Fix category selection on Enter key

tests:
- Integration: Test category navigation with keyboard
- Manual: Navigate categories with arrow keys
- Edge case: Test category navigation from shows list

acceptance_criteria:
- Arrow keys navigate categories correctly
- Category index updates on navigation
- Enter key selects category and updates shows list

validation:
- Use arrow keys to navigate categories
- Verify category highlight moves correctly
- Press Enter to select category and verify show list updates

notes:
- Check if categoryIndex signal is bound correctly
- Ensure arrow keys update categoryIndex signal
- Verify categoryIndex is used in filteredPodcasts()
- Test category navigation from shows list back to categories
- Add keyboard hints in UI
