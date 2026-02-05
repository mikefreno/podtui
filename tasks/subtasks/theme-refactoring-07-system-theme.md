# 07. Implement System Theme Detection with Terminal Palette

meta:
  id: theme-refactoring-07
  feature: theme-refactoring-json-format
  priority: P1
  depends_on: [theme-refactoring-04, theme-refactoring-06]
  tags: [implementation, detection]

objective:
- Implement system theme detection based on terminal palette
- Generate system theme from terminal colors
- Detect light/dark mode based on terminal background
- Handle terminal color palette limitations

deliverables:
- `src/utils/system-theme.ts` - System theme detection utilities
- `src/utils/color-generation.ts` - Color generation helpers

steps:
- Step 7.1: Create `src/utils/system-theme.ts`
  - Implement `detectSystemTheme()` function
  - Detect terminal background and foreground colors
  - Determine light/dark mode based on luminance
  - Return detected theme information

- Step 7.2: Implement terminal palette detection
  - Detect terminal colors using `@opentui/core` renderer
  - Get default background and foreground colors
  - Extract color palette (16 standard colors)
  - Handle missing or invalid palette data

- Step 7.3: Create `src/utils/color-generation.ts`
  - Implement `generateGrayScale(bg: RGBA, isDark: boolean): Record<number, RGBA>`
  - Implement `generateMutedTextColor(bg: RGBA, isDark: boolean): RGBA`
  - Implement `tint(base: RGBA, overlay: RGBA, alpha: number): RGBA`
  - Generate gray scale based on background luminance
  - Generate muted text colors for readability

- Step 7.4: Create system theme JSON generator
  - Implement `generateSystemTheme(colors: TerminalColors, mode: "dark" | "light"): ThemeJson`
  - Use ANSI color references for primary colors
  - Generate appropriate background colors
  - Generate diff colors with alpha blending
  - Generate markdown and syntax colors

- Step 7.5: Add system theme caching
  - Cache terminal palette detection results
  - Handle palette cache invalidation
  - Support manual cache clear on SIGUSR2

tests:
- Unit:
  - Test `detectSystemTheme` returns correct mode
  - Test `generateGrayScale` produces correct grays
  - Test `generateMutedTextColor` produces readable colors
  - Test `tint` produces correct blended colors
  - Test `generateSystemTheme` produces valid theme JSON

- Integration/e2e:
  - Test system theme detection in terminal
  - Test theme generation with actual terminal palette
  - Verify light/dark mode detection is accurate

acceptance_criteria:
- `src/utils/system-theme.ts` file exists with detection functions
- `src/utils/color-generation.ts` file exists with generation helpers
- System theme detection works correctly
- Light/dark mode detection is accurate
- Theme generation produces valid JSON

validation:
- Run: `bun run typecheck` - Should pass
- Run: `bun test src/utils/system-theme.test.ts`
- Run: `bun test src/utils/color-generation.test.ts`
- Test system theme detection manually in terminal
- Verify theme colors are readable

notes:
- Use opencode's system theme detection as reference
- Handle terminal transparency gracefully
- Add fallback for terminals without palette support
- Reference: `/home/mike/code/PodTui/opencode/packages/opencode/src/cli/cmd/tui/context/theme.tsx` (lines 428-535)
