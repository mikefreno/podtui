# 11. Verify Custom Theme Loading and Persistence

meta:
  id: theme-refactoring-11
  feature: theme-refactoring-json-format
  priority: P1
  depends_on: [theme-refactoring-06, theme-refactoring-10]
  tags: [testing, verification]

objective:
- Test custom theme loading from directories
- Verify theme persistence works correctly
- Test custom theme switching
- Ensure custom themes are loaded on app start

deliverables:
- Test results for custom theme loading
- Documentation for custom theme format
- Verification that custom themes work correctly

steps:
- Step 11.1: Create test theme files
  - Create test theme in `~/.config/podtui/themes/`
  - Create test theme in `./.podtui/themes/`
  - Create test theme in `./themes/`

- Step 11.2: Test custom theme loading
  - Start application and verify custom themes are loaded
  - Switch to custom theme
  - Verify custom theme applies correctly

- Step 11.3: Test theme persistence
  - Set custom theme
  - Close application
  - Reopen application
  - Verify custom theme is still selected

- Step 11.4: Test theme discovery
  - List all available themes
  - Verify custom themes appear in list
  - Test switching to custom themes

- Step 11.5: Test invalid theme handling
  - Create invalid theme JSON
  - Verify error is handled gracefully
  - Verify app doesn't crash

tests:
- Unit:
  - Test custom theme loading functions
  - Test theme discovery
  - Test invalid theme handling

- Integration/e2e:
  - Test custom theme loading from directories
  - Test theme persistence
  - Test theme discovery
  - Test invalid theme handling

acceptance_criteria:
- Custom themes can be loaded from directories
- Custom themes persist across sessions
- Custom themes appear in theme list
- Invalid themes are handled gracefully
- Theme discovery works correctly

validation:
- Run: `bun test src/utils/custom-themes.test.ts`
- Run: `bun test` - Run all tests
- Manual testing of custom themes
- Verify themes persist after restart

notes:
- Create documentation for custom theme format
- Reference: `/home/mike/code/PodTui/opencode/packages/opencode/src/cli/cmd/tui/context/theme.tsx` (lines 394-419)
- Test with multiple custom themes
- Verify all custom themes work correctly
