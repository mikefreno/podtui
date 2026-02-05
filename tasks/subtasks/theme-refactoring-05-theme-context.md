# 05. Migrate ThemeContext to SolidJS Pattern

meta:
  id: theme-refactoring-05
  feature: theme-refactoring-json-format
  priority: P0
  depends_on: [theme-refactoring-04]
  tags: [implementation, context]

objective:
- Migrate ThemeContext from basic React context to SolidJS context pattern
- Implement reactive state management for theme switching
- Add persistence for theme selection and mode
- Support system theme detection

deliverables:
- `src/context/ThemeContext.tsx` - Updated with SolidJS pattern
- `src/utils/theme-context.ts` - Theme context utilities

steps:
- Step 5.1: Update `src/context/ThemeContext.tsx`
  - Import SolidJS hooks: `createSignal`, `createEffect`, `createMemo`, `createStore`
  - Replace React context with SolidJS `createSimpleContext` pattern (from opencode)
  - Add theme loading logic
  - Implement reactive theme state
  - Add system theme detection
  - Support theme persistence via localStorage

- Step 5.2: Implement theme state management
  - Create store with `themes`, `mode`, `active`, `ready`
  - Initialize with default theme (opencode)
  - Load custom themes from JSON files
  - Handle system theme detection

- Step 5.3: Add reactive theme resolution
  - Create `createMemo` for resolved theme colors
  - Create `createMemo` for syntax highlighting
  - Create `createMemo` for subtle syntax

- Step 5.4: Implement theme switching
  - Add `setTheme(theme: string)` method
  - Add `setMode(mode: "dark" | "light")` method
  - Persist theme and mode to localStorage

- Step 5.5: Add system theme detection
  - Detect terminal background and foreground colors
  - Generate system theme based on terminal palette
  - Handle system theme preference changes

tests:
- Unit:
  - Test theme state initialization
  - Test theme switching logic
  - Test mode switching logic
  - Test system theme detection
  - Test localStorage persistence

- Integration/e2e:
  - Test theme context in component tree
  - Test reactive theme updates
  - Test system theme changes

acceptance_criteria:
- `src/context/ThemeContext.tsx` uses SolidJS pattern
- Theme context provides reactive theme state
- Theme switching works correctly
- System theme detection is functional
- Theme and mode are persisted to localStorage

validation:
- Run: `bun run typecheck` - Should pass
- Run: `bun test src/context/ThemeContext.test.ts`
- Test theme switching in application
- Test system theme detection

notes:
- Use opencode's ThemeProvider pattern as reference
- Follow SolidJS best practices for reactive state
- Ensure proper cleanup of effects and listeners
- Reference: `/home/mike/code/PodTui/opencode/packages/opencode/src/cli/cmd/tui/context/theme.tsx` (lines 279-392)
