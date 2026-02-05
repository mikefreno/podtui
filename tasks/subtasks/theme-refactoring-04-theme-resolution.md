# 04. Create Theme Resolution Logic with Color Reference Lookup

meta:
  id: theme-refactoring-04
  feature: theme-refactoring-json-format
  priority: P0
  depends_on: [theme-refactoring-02, theme-refactoring-03]
  tags: [implementation, logic]

objective:
- Implement theme resolution logic that handles color references and variants
- Create function to resolve colors from theme JSON files
- Support hex colors, color references, ANSI codes, and RGBA values
- Handle light/dark mode selection based on current mode

deliverables:
- `src/utils/theme-resolver.ts` - Theme resolution utility
- `src/utils/ansi-to-rgba.ts` - ANSI color conversion utility

steps:
- Step 4.1: Create `src/utils/ansi-to-rgba.ts`
  - Implement `ansiToRgba(code: number): RGBA` function
  - Handle standard ANSI colors (0-15)
  - Handle 6x6x6 color cube (16-231)
  - Handle grayscale ramp (232-255)
  - Add type definitions for RGBA

- Step 4.2: Create `src/utils/theme-resolver.ts`
  - Implement `resolveTheme(theme: ThemeJson, mode: "dark" | "light"): ThemeColors`
  - Create `resolveColor(c: ColorValue): RGBA` helper function
  - Handle RGBA objects directly
  - Handle hex color strings
  - Handle color references from `defs`
  - Handle variants (dark/light mode)
  - Handle ANSI codes
  - Add error handling for invalid color references

- Step 4.3: Implement color reference resolution
  - Create lookup logic for `defs` object
  - Add fallback to theme colors if reference not in defs
  - Throw descriptive errors for invalid references

- Step 4.4: Handle optional theme properties
  - Support `selectedListItemText` property
  - Support `backgroundMenu` property
  - Support `thinkingOpacity` property
  - Add default values for missing properties

tests:
- Unit:
  - Test `ansiToRgba` with ANSI codes 0-15
  - Test `ansiToRgba` with color cube codes 16-231
  - Test `ansiToRgba` with grayscale codes 232-255
  - Test `resolveColor` with hex colors
  - Test `resolveColor` with color references
  - Test `resolveColor` with light/dark variants
  - Test `resolveColor` with RGBA objects
  - Test `resolveTheme` with complete theme JSON
  - Test `resolveTheme` with missing optional properties
  - Test error handling for invalid color references

- Integration/e2e:
  - Test resolving colors from actual theme JSON files
  - Verify light/dark mode selection works correctly

acceptance_criteria:
- `src/utils/ansi-to-rgba.ts` file exists with conversion functions
- `src/utils/theme-resolver.ts` file exists with resolution logic
- All color value types are handled correctly
- Error messages are descriptive and helpful
- Theme resolution works with both light and dark modes

validation:
- Run: `bun run typecheck` - Should pass
- Run unit tests with `bun test src/utils/theme-resolver.test.ts`
- Test with sample theme JSON files
- Verify error messages are clear

notes:
- Use opencode's implementation as reference for color resolution
- Ensure RGBA values are normalized to 0-1 range
- Add comprehensive error handling for invalid inputs
- Reference: `/home/mike/code/PodTui/opencode/packages/opencode/src/cli/cmd/tui/context/theme.tsx` (lines 176-277)
