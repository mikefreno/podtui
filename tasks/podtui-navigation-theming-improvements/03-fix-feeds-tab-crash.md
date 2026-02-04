# 03. Fix My Feeds Tab Crash

meta:
  id: podtui-navigation-theming-improvements-03
  feature: podtui-navigation-theming-improvements
  priority: P1
  depends_on: [podtui-navigation-theming-improvements-01]
  tags: [bug-fix, feeds, crash]

objective:
- Identify and fix crash when My Feeds tab is selected
- Ensure FeedList component loads without errors
- Test all functionality in My Feeds tab

deliverables:
- Fixed FeedList.tsx component
- Debugged crash identified and resolved
- Test results showing no crashes

steps:
- Read src/components/FeedList.tsx thoroughly
- Check for null/undefined references in FeedList
- Verify useFeedStore() is properly initialized
- Check FeedItem component for issues
- Verify filteredFeeds() returns valid array
- Add null checks and error boundaries if needed
- Test tab selection in App.tsx
- Verify no console errors
- Test all keyboard shortcuts in FeedList

tests:
- Unit: Test FeedList component with mocked store
- Integration: Test Feeds tab selection and navigation

acceptance_criteria:
- My Feeds tab can be selected without crashes
- No console errors when My Feeds tab is active
- All FeedList functionality works (keyboard shortcuts, navigation)
- FeedItem components render correctly

validation:
- Run `bun run start` and select My Feeds tab
- Check console for errors
- Test all keyboard interactions (j/k, enter, f, s, esc)
- Verify feed list renders correctly

notes:
- Common crash causes: null store, undefined feeds, missing component imports
- Check for unhandled promises or async operations
- Verify all props are properly passed from App.tsx
