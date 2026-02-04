# 11. Implement Theme Resolution System

meta:
  id: podtui-navigation-theming-improvements-11
  feature: podtui-navigation-theming-improvements
  priority: P2
  depends_on: [podtui-navigation-theming-improvements-10]
  tags: [theming, implementation, theme-resolution]

objective:
- Implement theme resolution system for light and dark variants
- Create theme token generation logic
- Define color scale generation functions

deliverables:
- Theme resolution functions
- Color scale generation functions
- Theme token generation logic
- Theme CSS variable generation

steps:
- Read opencode/packages/ui/src/theme/resolve.ts for reference
- Implement resolveThemeVariant function
- Implement generateNeutralScale function
- Implement generateScale function
- Implement hexToOklch and oklchToHex functions
- Implement withAlpha function
- Implement themeToCss function
- Create theme resolution constants
- Define color scale configurations
- Implement theme resolution for each theme
- Test theme resolution functions

tests:
- Unit: Test theme resolution with mocked themes
- Integration: Test theme resolution in context provider

acceptance_criteria:
- resolveThemeVariant function works correctly
- generateNeutralScale function works correctly
- generateScale function works correctly
- Color conversion functions work correctly
- themeToCss function generates valid CSS
- Theme resolution works for all themes
- Light and dark variants are resolved correctly

validation:
- Run `bun run start` and verify theme resolution works
- Test theme resolution for all themes
- Verify light/dark variants are correct
- Check CSS variable generation
- Test with different color schemes

notes:
- Use references/solid/REFERENCE.md for SolidJS patterns
- Follow opencode theming implementation patterns
- Ensure color scales are generated correctly
- Test color conversion functions
- Verify theme tokens match expected values
