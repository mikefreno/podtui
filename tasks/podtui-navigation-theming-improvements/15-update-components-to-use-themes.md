# 15. Update Components to Use Theme Tokens

meta:
  id: podtui-navigation-theming-improvements-15
  feature: podtui-navigation-theming-improvements
  priority: P3
  depends_on: [podtui-navigation-theming-improvements-14]
  tags: [theming, implementation, component-updates]

objective:
- Replace all hardcoded colors with theme tokens
- Update all components to use theme context
- Ensure consistent theme application across all components

deliverables:
- Updated components using theme tokens
- Theme token usage guide
- List of components updated

steps:
- Review all components in src/components/
- Identify all hardcoded color values
- Replace hardcoded colors with theme tokens:
  - Background colors (background-base, surface-base, etc.)
  - Text colors (text-base, text-weak, etc.)
  - Border colors (border-base, border-hover, etc.)
  - Interactive colors (interactive-base, interactive-hover, etc.)
  - Color tokens (success, warning, error, etc.)
  - Layer navigation colors (layer-active-bg, layer-inactive-bg, etc.)
- Update src/constants/themes.ts to export theme tokens
- Update all components to use theme context
- Test theme tokens in all components
- Verify no hardcoded colors remain
- Create theme token usage guide

tests:
- Unit: Test theme tokens in individual components
- Integration: Test theme tokens in all components

acceptance_criteria:
- All hardcoded colors are replaced with theme tokens
- All components use theme tokens
- Theme tokens are exported from themes.ts
- Theme token usage guide is created
- No console errors related to theming
- All components render correctly with theme tokens

validation:
- Run `bun run start` and verify all components use theme tokens
- Test theme selection and color scheme switching
- Verify all components render correctly
- Check console for errors
- Verify no hardcoded colors remain

notes:
- Use references/solid/REFERENCE.md for SolidJS patterns
- Follow opencode theming implementation patterns
- Ensure consistent theme application across all components
- Test theme tokens in all components
- Verify backward compatibility if needed
