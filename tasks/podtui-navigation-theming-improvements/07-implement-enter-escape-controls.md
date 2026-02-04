# 07. Implement Enter/Escape Layer Navigation Controls

meta:
  id: podtui-navigation-theming-improvements-07
  feature: podtui-navigation-theming-improvements
  priority: P1
  depends_on: [podtui-navigation-theming-improvements-05]
  tags: [implementation, navigation, keyboard]

objective:
- Enhance enter key to go down into a layer
- Enhance escape key to go up multiple layers at once
- Add visual feedback when entering/exiting layers
- Prevent invalid layer transitions

deliverables:
- Enhanced keyboard handler for enter/escape layer navigation
- Updated Navigation component with layer hints
- Visual feedback for layer navigation
- Layer boundary prevention logic

steps:
- Update useAppKeyboard hook to handle enter for going down
- Update useAppKeyboard hook to handle escape for going up multiple layers
- Add visual feedback when entering/exiting layers
- Prevent invalid layer transitions (can't go down from max depth)
- Update Navigation component to show layer navigation hints
- Add visual indicators for current layer position
- Test enter to go down, escape to go up
- Ensure proper layer nesting behavior

tests:
- Unit: Test keyboard handler with mocked key events
- Integration: Test enter/escape navigation between layers

acceptance_criteria:
- <enter> key goes down into a layer (prevents going below max depth)
- <escape> key goes up multiple layers at once
- Current layer is visually indicated
- Navigation hints are shown in Navigation component
- No keyboard conflicts with page-specific shortcuts
- Navigation works correctly at layer boundaries

validation:
- Run `bun run start` and test enter/escape navigation
- Verify current layer is highlighted
- Check that navigation hints are visible
- Test at layer boundaries (first/last layer)
- Verify no conflicts with page shortcuts

notes:
- Use existing useAppKeyboard hook as base
- Consider max layer depth (3-4 levels)
- Ensure smooth visual transitions
- Consider adding sound effects for navigation
