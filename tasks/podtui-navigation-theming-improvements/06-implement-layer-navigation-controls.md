# 06. Implement Left/Right Layer Navigation Controls

meta:
  id: podtui-navigation-theming-improvements-06
  feature: podtui-navigation-theming-improvements
  priority: P1
  depends_on: [podtui-navigation-theming-improvements-05]
  tags: [implementation, navigation, keyboard]

objective:
- Enhance left/right arrow key navigation between layers
- Add visual feedback when navigating layers
- Prevent invalid layer transitions (can't go left from layer 0)
- Add navigation hints in Navigation component

deliverables:
- Enhanced keyboard handler with layer navigation
- Updated Navigation component with layer hints
- Visual feedback for layer navigation
- Layer boundary prevention logic

steps:
- Update useAppKeyboard hook to handle left/right for layer navigation
- Add layer navigation visual feedback
- Prevent invalid layer transitions (can't go left from layer 0, can't go right beyond max)
- Update Navigation component to show layer navigation hints
- Add visual indicators for current layer position
- Test navigation between layers
- Ensure keyboard shortcuts don't conflict with page-specific shortcuts

tests:
- Unit: Test keyboard handler with mocked key events
- Integration: Test left/right navigation between layers

acceptance_criteria:
- <left> key navigates to previous layer (prevents going below layer 0)
- <right> key navigates to next layer (prevents exceeding max depth)
- Current layer is visually indicated
- Navigation hints are shown in Navigation component
- No keyboard conflicts with page-specific shortcuts
- Navigation works correctly at layer boundaries

validation:
- Run `bun run start` and test left/right navigation
- Verify current layer is highlighted
- Check that navigation hints are visible
- Test at layer boundaries (first/last layer)
- Verify no conflicts with page shortcuts

notes:
- Use existing useAppKeyboard hook as base
- Consider max layer depth (3-4 levels)
- Ensure smooth visual transitions
- Consider adding sound effects for navigation
