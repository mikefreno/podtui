# 07. Implement Enter/Escape Layer Navigation Controls

meta:
  id: podtui-navigation-theming-improvements-07
  feature: podtui-navigation-theming-improvements
  priority: P2
  depends_on: [podtui-navigation-theming-improvements-05]
  tags: [implementation, navigation, keyboard]

objective:
- Implement <enter> key to go down into a layer
- Implement <escape> key to go up one layer
- Update layer navigation to support entering/exiting layers

deliverables:
- Updated layer navigation logic for enter/escape
- Updated Navigation component to show enter/escape hints
- Updated App.tsx keyboard handlers

steps:
- Update Navigation component to show enter/escape navigation hints
- Add <enter> key handler in App.tsx useAppKeyboard hook
- Add <escape> key handler in App.tsx useAppKeyboard hook
- Update layerDepth signal to track current layer (0 = top level)
- Implement logic for entering a layer (increase layerDepth)
- Implement logic for exiting a layer (decrease layerDepth)
- Add visual feedback when entering/exiting layers
- Update all page components to handle layerDepth prop
- Test enter to go down, escape to go up
- Ensure proper layer nesting behavior

tests:
- Unit: Test keyboard handler with mocked key events
- Integration: Test enter/escape navigation between layers

acceptance_criteria:
- <enter> key goes down into a layer
- <escape> key goes up one layer
- Navigation hints show enter/escape directions
- Layer depth is properly tracked and managed
- Visual feedback shows current layer depth
- No keyboard conflicts with page-specific shortcuts
- Proper layer nesting behavior

validation:
- Run `bun run start` and test enter/escape navigation
- Verify layer depth is visually indicated
- Check that navigation hints are visible
- Test proper layer nesting behavior
- Verify no conflicts with page shortcuts

notes:
- Use references/keyboard/REFERENCE.md for proper keyboard handling patterns
- Consider terminal width limitations for layer hints
- Ensure consistent behavior across all pages
- Test with different layer depths
- Verify escape works at all layer depths
