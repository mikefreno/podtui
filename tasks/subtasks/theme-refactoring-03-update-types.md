# 03. Update Type Definitions for Color References and Variants

meta:
  id: theme-refactoring-03
  feature: theme-refactoring-json-format
  priority: P0
  depends_on: [theme-refactoring-01]
  tags: [implementation, types]

objective:
- Update type definitions to support the new JSON theme structure
- Add support for color references, variants, and light/dark mode
- Maintain backward compatibility with existing code

deliverables:
- `src/types/theme-schema.ts` - Updated with new types
- `src/types/settings.ts` - Updated with color reference types
- `src/types/desktop-theme.ts` - Updated to support JSON themes

steps:
- Step 3.1: Update `src/types/theme-schema.ts`
  - Export `ThemeJson` interface
  - Export `ColorValue` type
  - Export `Variant` type
  - Add `ThemeColors` type for resolved theme colors

- Step 3.2: Update `src/types/settings.ts`
  - Add `ThemeJson` import
  - Add `ColorValue` type definition
  - Add `Variant` type definition
  - Update `ThemeColors` to support color references
  - Add `ThemeJson` type for JSON theme files

- Step 3.3: Update `src/types/desktop-theme.ts`
  - Add imports for `ThemeJson`, `ColorValue`, `Variant`
  - Add `ThemeJson` type for JSON theme files
  - Update existing types to support color references
  - Add helper functions for JSON theme loading

- Step 3.4: Ensure backward compatibility
  - Keep existing `ThemeColors` structure for resolved themes
  - Ensure existing code can still use theme colors as strings
  - Add type guards for color references

tests:
- Unit:
  - Test `ThemeJson` type accepts valid JSON theme structure
  - Test `ColorValue` type accepts hex colors, references, variants, and RGBA
  - Test `Variant` type structure is correct
  - Test existing `ThemeColors` type remains compatible

- Integration/e2e:
  - Verify type imports work correctly
  - Test type inference with JSON theme files

acceptance_criteria:
- All type definitions are updated and exported
- Backward compatibility maintained with existing code
- New types support color references and variants
- Type checking passes without errors

validation:
- Run: `bun run typecheck` - Should pass with no errors
- Verify existing components can still use theme colors
- Test type inference with new theme JSON files

notes:
- Use TypeScript's `with { type: "json" }` for JSON imports
- Ensure all types are properly exported for use across the codebase
- Reference: `/home/mike/code/PodTui/opencode/packages/opencode/src/cli/cmd/tui/context/theme.tsx`
