# 06. Add Theme Loader for JSON Files and Custom Themes

meta:
  id: theme-refactoring-06
  feature: theme-refactoring-json-format
  priority: P1
  depends_on: [theme-refactoring-02, theme-refactoring-04]
  tags: [implementation, loading]

objective:
- Create theme loader to load JSON theme files
- Support loading custom themes from multiple directories
- Provide API for theme discovery and loading
- Handle theme file validation

deliverables:
- `src/utils/theme-loader.ts` - Theme loader utilities
- `src/utils/custom-themes.ts` - Custom theme loading logic

steps:
- Step 6.1: Create `src/utils/theme-loader.ts`
  - Implement `loadTheme(name: string): Promise<ThemeJson>`
  - Implement `loadThemeFromPath(path: string): Promise<ThemeJson>`
  - Implement `getAllThemes(): Promise<Record<string, ThemeJson>>`
  - Add error handling for missing or invalid theme files

- Step 6.2: Create `src/utils/custom-themes.ts`
  - Implement `getCustomThemes()` function
  - Scan for theme files in multiple directories:
    - `~/.config/podtui/themes/`
    - `./.podtui/themes/`
    - Project root `./themes/`
  - Support custom theme files with `.json` extension
  - Return merged theme registry

- Step 6.3: Add theme file validation
  - Validate theme JSON structure
  - Check required properties (`defs`, `theme`)
  - Validate color references in `defs`
  - Add warning for optional properties

- Step 6.4: Implement theme discovery
  - List all available theme files
  - Provide theme metadata (name, description)
  - Support theme aliases (e.g., "catppuccin" -> "catppuccin.json")

tests:
- Unit:
  - Test `loadTheme` with existing theme files
  - Test `loadTheme` with missing theme files
  - Test `loadThemeFromPath` with custom paths
  - Test `getAllThemes` returns all available themes
  - Test `getCustomThemes` scans multiple directories
  - Test theme file validation

- Integration/e2e:
  - Test loading all available themes
  - Test custom theme loading from directories
  - Verify theme discovery works correctly

acceptance_criteria:
- `src/utils/theme-loader.ts` file exists with loading functions
- `src/utils/custom-themes.ts` file exists with custom theme logic
- Custom themes can be loaded from multiple directories
- Theme validation prevents invalid files
- Theme discovery API is functional

validation:
- Run: `bun run typecheck` - Should pass
- Run: `bun test src/utils/theme-loader.test.ts`
- Run: `bun test src/utils/custom-themes.test.ts`
- Test loading all available themes manually
- Test custom theme loading from directories

notes:
- Use opencode's `getCustomThemes` pattern as reference
- Support both local and global theme directories
- Add comprehensive error messages for invalid theme files
- Reference: `/home/mike/code/PodTui/opencode/packages/opencode/src/cli/cmd/tui/context/theme.tsx` (lines 394-419)
