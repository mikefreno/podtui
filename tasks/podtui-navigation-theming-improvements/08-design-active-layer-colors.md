# 08. Design Active Layer Background Color System

meta:
  id: podtui-navigation-theming-improvements-08
  feature: podtui-navigation-theming-improvements
  priority: P1
  depends_on: [podtui-navigation-theming-improvements-05]
  tags: [implementation, theming, navigation]

objective:
- Design active layer background colors for each depth level
- Define color palette for layer backgrounds
- Create theme-aware layer styling
- Implement visual hierarchy for layers

deliverables:
- Enhanced theme system with layer backgrounds
- Layer background colors for all themes
- Visual hierarchy implementation
- Theme tokens for layer backgrounds

steps:
- Review existing theme system in src/constants/themes.ts
- Design layer background colors for layer 0-3
- Define color palette that works with existing themes
- Add layerBackgrounds property to theme colors
- Implement layer background rendering in Layout component
- Add visual indicators for active/inactive layers
- Ensure colors work with system/light/dark modes
- Test layer color transitions

tests:
- Unit: Test theme layer backgrounds
- Integration: Test layer color rendering

acceptance_criteria:
- Layer background colors are defined for all themes
- Active layer is clearly visible with distinct background
- Inactive layers have subtle background variations
- Visual hierarchy is clear between layers
- Colors work with all theme modes
- Layer backgrounds are accessible and readable

validation:
- Run `bun run start` and test layer colors
- Verify layer backgrounds appear at different depths
- Check that active layer is clearly visible
- Test with different themes (catppuccin, gruvbox, etc.)
- Verify colors work in both light and dark modes

notes:
- Use existing theme colors for layer backgrounds
- Ensure high contrast for readability
- Colors should be subtle but clearly visible
- Consider terminal color limitations
- Design should be consistent with existing UI elements
