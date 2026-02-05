# 10. Test Theme Switching and Light/Dark Mode

meta:
  id: theme-refactoring-10
  feature: theme-refactoring-json-format
  priority: P0
  depends_on: [theme-refactoring-05, theme-refactoring-09]
  tags: [testing, verification]

objective:
- Comprehensive testing of theme switching functionality
- Verify light/dark mode switching works correctly
- Test all theme JSON files load and apply correctly
- Ensure theme persistence works across sessions

deliverables:
- `src/utils/theme.test.ts` - Theme utility tests
- `src/context/ThemeContext.test.ts` - Context tests
- Test results showing all themes work correctly

steps:
- Step 10.1: Create `src/utils/theme.test.ts`
  - Test theme loading functions
  - Test theme resolution logic
  - Test color reference resolution
  - Test ANSI color conversion

- Step 10.2: Create `src/context/ThemeContext.test.ts`
  - Test theme context initialization
  - Test theme switching
  - Test mode switching
  - Test system theme detection
  - Test localStorage persistence
  - Test reactive theme updates

- Step 10.3: Manual testing
  - Test switching between all themes (catppuccin, gruvbox, tokyo, nord)
  - Test light/dark mode switching
  - Test system theme detection
  - Test theme persistence (close and reopen app)
  - Test custom theme loading

- Step 10.4: Visual verification
  - Verify all theme colors are correct
  - Check readability of text colors
  - Verify background colors are appropriate
  - Check that all UI elements use theme colors

tests:
- Unit:
  - Run all theme utility tests
  - Run all theme context tests
  - Verify all tests pass

- Integration/e2e:
  - Test theme switching in application
  - Test light/dark mode switching
  - Test theme persistence
  - Test system theme detection

acceptance_criteria:
- All unit tests pass
- All integration tests pass
- Theme switching works correctly
- Light/dark mode switching works correctly
- All themes load and apply correctly
- Theme persistence works across sessions

validation:
- Run: `bun test src/utils/theme.test.ts`
- Run: `bun test src/context/ThemeContext.test.ts`
- Run: `bun test` - Run all tests
- Manual testing of all themes
- Visual verification of theme appearance

notes:
- Test with actual terminal to verify system theme detection
- Verify all theme colors are visually appealing
- Check for any color contrast issues
- Test edge cases (missing themes, invalid colors)
