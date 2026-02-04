# 10. Implement DesktopTheme Type and Structure

meta:
  id: podtui-navigation-theming-improvements-10
  feature: podtui-navigation-theming-improvements
  priority: P2
  depends_on: [podtui-navigation-theming-improvements-09]
  tags: [theming, implementation, types]

objective:
- Implement DesktopTheme type and structure based on opencode
- Define theme data structure for light and dark variants
- Create theme token types

deliverables:
- DesktopTheme type definition
- Theme variant structure
- Token type definitions
- Example theme data

steps:
- Read opencode/packages/ui/src/theme/types.ts for reference
- Create DesktopTheme type interface
- Define ThemeVariant structure with seeds and overrides
- Define ThemeColor type
- Define ColorScheme type
- Define ResolvedTheme type
- Define ColorValue type
- Create theme constants file
- Add example theme data (system, catppuccin, gruvbox, tokyo, nord)
- Test type definitions

tests:
- Unit: Test type definitions with TypeScript compiler
- Integration: None (type definition task)

acceptance_criteria:
- DesktopTheme type is defined
- ThemeVariant structure is defined
- ThemeColor type is defined
- ColorScheme type is defined
- ResolvedTheme type is defined
- ColorValue type is defined
- Example theme data is provided
- All types are exported correctly

validation:
- Run `tsc --noEmit` to verify no TypeScript errors
- Test theme type usage in components
- Verify theme data structure is correct

notes:
- Use references/solid/REFERENCE.md for SolidJS patterns
- Follow opencode theming implementation patterns
- Ensure types are comprehensive and well-documented
- Add JSDoc comments for complex types
- Consider TypeScript strict mode compliance
