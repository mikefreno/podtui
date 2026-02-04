# 02. Fix Discover Tab Crash

meta:
  id: podtui-navigation-theming-improvements-02
  feature: podtui-navigation-theming-improvements
  priority: P1
  depends_on: [podtui-navigation-theming-improvements-01]
  tags: [bug-fix, discover, crash]

objective:
- Identify and fix crash when Discover tab is selected
- Ensure DiscoverPage component loads without errors
- Test all functionality in Discover tab

deliverables:
- Fixed DiscoverPage.tsx component
- Debugged crash identified and resolved
- Test results showing no crashes

steps:
- Read src/components/DiscoverPage.tsx thoroughly
- Check for null/undefined references in DiscoverPage
- Verify useDiscoverStore() is properly initialized
- Check DISCOVER_CATEGORIES constant
- Verify TrendingShows component works correctly
- Check CategoryFilter component for issues
- Add null checks and error boundaries if needed
- Test tab selection in App.tsx
- Verify no console errors
- Test all keyboard shortcuts in Discover tab

tests:
- Unit: Test DiscoverPage component with mocked store
- Integration: Test Discover tab selection and navigation

acceptance_criteria:
- Discover tab can be selected without crashes
- No console errors when Discover tab is active
- All DiscoverPage functionality works (keyboard shortcuts, navigation)
- TrendingShows and CategoryFilter components render correctly

validation:
- Run `bun run start` and select Discover tab
- Check console for errors
- Test all keyboard interactions (j/k, tab, enter, escape, r)
- Verify content renders correctly

notes:
- Common crash causes: null store, undefined categories, missing component imports
- Check for unhandled promises or async operations
- Verify all props are properly passed from App.tsx
