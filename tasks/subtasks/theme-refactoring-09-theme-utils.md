# 09. Update Theme Utilities and CSS Variable Application

meta:
  id: theme-refactoring-09
  feature: theme-refactoring-json-format
  priority: P1
  depends_on: [theme-refactoring-04]
  tags: [implementation, utilities]

objective:
- Update existing theme utilities to work with JSON theme structure
- Refactor CSS variable application logic
- Add support for theme color references
- Ensure backward compatibility with existing components

deliverables:
- `src/utils/theme.ts` - Updated theme utilities
- `src/utils/theme-css.ts` - CSS variable application utilities

steps:
- Step 9.1: Update `src/utils/theme.ts`
  - Refactor `applyTheme()` to accept `ThemeColors` type
  - Keep existing function signature for backward compatibility
  - Update to work with resolved theme colors

- Step 9.2: Create `src/utils/theme-css.ts`
  - Implement `applyThemeToCSS(theme: ThemeColors)` function
  - Apply theme colors as CSS custom properties
  - Support all theme color properties
  - Handle layer backgrounds if present

- Step 9.3: Update theme attribute handling
  - Implement `setThemeAttribute(themeName: string)` function
  - Update to use data-theme attribute
  - Support system theme attribute

- Step 9.4: Add color reference support
  - Implement `resolveColorReference(color: string): string` function
  - Convert color references to CSS values
  - Handle hex colors, color references, and RGBA

- Step 9.5: Add theme utility functions
  - Implement `getThemeByName(name: string): ThemeJson | undefined`
  - Implement `getDefaultTheme(): ThemeJson`
  - Implement `getAllThemes(): ThemeJson[]`

tests:
- Unit:
  - Test `applyThemeToCSS` applies all colors correctly
  - Test `setThemeAttribute` sets attribute correctly
  - Test `resolveColorReference` converts references correctly
  - Test theme utility functions return correct results

- Integration/e2e:
  - Test theme application in browser
  - Verify CSS variables are updated correctly
  - Test theme attribute changes

acceptance_criteria:
- `src/utils/theme.ts` is updated and backward compatible
- `src/utils/theme-css.ts` file exists with CSS utilities
- CSS variables are applied correctly
- Color references are resolved properly
- Theme utilities are functional

validation:
- Run: `bun run typecheck` - Should pass
- Run: `bun test src/utils/theme.test.ts`
- Run: `bun test src/utils/theme-css.test.ts`
- Test theme application in browser
- Verify CSS variables are applied correctly

notes:
- Maintain backward compatibility with existing code
- Use CSS custom properties for theming
- Ensure all theme colors are applied
- Reference: `/home/mike/code/PodTui/src/utils/theme.ts` (original file)
