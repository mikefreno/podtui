# 12. Create CSS Variable Token System

meta:
  id: podtui-navigation-theming-improvements-12
  feature: podtui-navigation-theming-improvements
  priority: P3
  depends_on: [podtui-navigation-theming-improvements-11]
  tags: [theming, implementation, css-variables]

objective:
- Create comprehensive CSS variable token system
- Define all theme tokens for OpenTUI components
- Generate CSS variables from theme tokens

deliverables:
- CSS variable token definitions
- Theme CSS generation functions
- CSS variable application utilities

steps:
- Read opencode/packages/ui/src/theme/resolve.ts for reference
- Review opencode theme token definitions
- Define theme tokens for OpenTUI components:
  - Background tokens (background-base, background-weak, etc.)
  - Surface tokens (surface-base, surface-raised, etc.)
  - Text tokens (text-base, text-weak, etc.)
  - Border tokens (border-base, border-hover, etc.)
  - Interactive tokens (interactive-base, interactive-hover, etc.)
  - Color tokens for specific states (success, warning, error, etc.)
  - Layer navigation tokens (layer-active-bg, layer-inactive-bg, etc.)
- Implement themeToCss function to generate CSS variables
- Create utility to apply theme tokens to components
- Test CSS variable generation

tests:
- Unit: Test CSS variable generation
- Integration: Test CSS variable application in components

acceptance_criteria:
- All OpenTUI theme tokens are defined
- CSS variable generation works correctly
- Theme tokens can be applied to components
- Generated CSS is valid
- Tokens cover all component styling needs

validation:
- Run `bun run start` and verify CSS variables are applied
- Test theme token application in components
- Check CSS variable values
- Verify tokens work with existing components

notes:
- Use references/solid/REFERENCE.md for SolidJS patterns
- Follow opencode theming implementation patterns
- Ensure tokens are comprehensive and well-organized
- Test token application in various components
- Consider backward compatibility with existing hardcoded colors
