# 08. Design Active Layer Background Color System

meta:
  id: podtui-navigation-theming-improvements-08
  feature: podtui-navigation-theming-improvements
  priority: P3
  depends_on: [podtui-navigation-theming-improvements-05]
  tags: [design, theming, navigation]

objective:
- Design active layer background colors
- Define color palette for layer backgrounds
- Create theme-aware layer styling

deliverables:
- Layer color design document
- Theme tokens for layer backgrounds
- Implementation plan for layer styling

steps:
- Review existing theme system in src/constants/themes.ts
- Design layer background colors (active layer, inactive layers)
- Define color palette that works with existing themes
- Create theme tokens for layer backgrounds (e.g., layer-active-bg, layer-inactive-bg)
- Design border colors for layer separation
- Design indicator colors for current layer position
- Create implementation plan for applying layer colors
- Ensure colors work with system/light/dark modes

tests:
- Unit: None (design task)
- Integration: None (design task)

acceptance_criteria:
- Layer color design document is created
- Active layer background color is defined
- Inactive layer background color is defined
- Theme tokens are designed for layer backgrounds
- Colors work with existing theme system
- Implementation plan is provided

validation:
- Review design document for clarity
- Verify colors work with existing themes
- Check that colors are accessible and readable
- Ensure colors work in both light and dark modes

notes:
- Use existing theme tokens where possible
- Ensure contrast ratios meet accessibility standards
- Colors should be subtle but clearly visible
- Consider terminal color limitations
- Design should be consistent with existing UI elements
