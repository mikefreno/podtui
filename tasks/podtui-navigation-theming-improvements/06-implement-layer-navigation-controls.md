# 06. Implement Left/Right Layer Navigation Controls

meta:
  id: podtui-navigation-theming-improvements-06
  feature: podtui-navigation-theming-improvements
  priority: P2
  depends_on: [podtui-navigation-theming-improvements-05]
  tags: [implementation, navigation, keyboard]

objective:
- Implement left/right arrow key navigation between layers
- Add keyboard handlers for <left> and <right> keys
- Update navigation state to track current layer index

deliverables:
- Updated Navigation component with left/right navigation
- Keyboard handler implementation in App.tsx
- Updated layer management logic

steps:
- Read references/keyboard/REFERENCE.md for keyboard handling patterns
- Design layer index management (currentLayer, maxLayers)
- Update Navigation component to show layer navigation hints
- Add <left> and <right> key handlers in App.tsx useAppKeyboard hook
- Update layerDepth signal to reflect current layer index
- Add visual indicators for current layer position
- Update layer rendering to show active layer with left/right arrows
- Test navigation between layers
- Ensure keyboard shortcuts don't conflict with page-specific shortcuts

tests:
- Unit: Test keyboard handler with mocked key events
- Integration: Test left/right navigation between layers

acceptance_criteria:
- <left> key navigates to previous layer
- <right> key navigates to next layer
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
- Use references/keyboard/REFERENCE.md for proper keyboard handling patterns
- Consider accessibility and screen reader support
- Ensure consistent behavior across all pages
- Test with different terminal sizes
