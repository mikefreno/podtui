# 04. Fix Settings/Sources Sub-tab Crash

meta:
  id: podtui-navigation-theming-improvements-04
  feature: podtui-navigation-theming-improvements
  priority: P1
  depends_on: [podtui-navigation-theming-improvements-01]
  tags: [bug-fix, settings, crash]

objective:
- Identify and fix crash when Settings/Sources sub-tab is selected
- Ensure SourceManager component loads without errors
- Test all functionality in Settings/Sources sub-tab

deliverables:
- Fixed SourceManager.tsx component
- Debugged crash identified and resolved
- Test results showing no crashes

steps:
- Read src/components/SourceManager.tsx thoroughly
- Check for null/undefined references in SourceManager
- Verify useFeedStore() is properly initialized
- Check all focus areas (list, add, url, country, explicit, language)
- Verify input component is properly imported and used
- Add null checks and error boundaries if needed
- Test Settings tab selection in App.tsx
- Test Sources sub-tab selection in SettingsScreen.tsx
- Verify no console errors
- Test all keyboard shortcuts and interactions

tests:
- Unit: Test SourceManager component with mocked store
- Integration: Test Settings tab → Sources sub-tab navigation

acceptance_criteria:
- Settings tab can be selected without crashes
- Sources sub-tab can be selected without crashes
- No console errors when Settings/Sources sub-tab is active
- All SourceManager functionality works (keyboard shortcuts, navigation)
- All form inputs and buttons work correctly

validation:
- Run `bun run start` and select Settings tab
- Select Sources sub-tab and verify it loads
- Check console for errors
- Test all keyboard interactions (tab, esc, enter, space, a, d)
- Verify form inputs work correctly

notes:
- Common crash causes: null store, undefined sources, missing component imports
- Check for unhandled promises or async operations
- Verify all props are properly passed from SettingsScreen.tsx
- Ensure useKeyboard hook doesn't conflict with parent keyboard handlers
