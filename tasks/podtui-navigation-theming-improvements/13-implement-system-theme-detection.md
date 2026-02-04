# 13. Implement System Theme Detection

meta:
  id: podtui-navigation-theming-improvements-13
  feature: podtui-navigation-theming-improvements
  priority: P2
  depends_on: [podtui-navigation-theming-improvements-12]
  tags: [theming, implementation, system-theme]

objective:
- Implement system theme detection (prefers-color-scheme)
- Add theme mode management (light/dark/auto)
- Implement automatic theme switching based on system preferences

deliverables:
- System theme detection implementation
- Theme mode management functions
- Automatic theme switching logic

steps:
- Read opencode/packages/ui/src/theme/context.tsx for reference
- Implement getSystemMode function
- Add theme mode state to theme context
- Implement colorScheme state management
- Add window.matchMedia listener for system theme changes
- Implement automatic mode switching when colorScheme is "system"
- Add theme mode persistence to localStorage
- Test system theme detection
- Test automatic theme switching

tests:
- Unit: Test system theme detection with mocked media queries
- Integration: Test theme mode switching

acceptance_criteria:
- getSystemMode function works correctly
- Theme mode state is managed correctly
- Window.matchMedia listener works correctly
- Automatic theme switching works when colorScheme is "system"
- Theme mode persistence to localStorage works
- System theme changes are detected and applied

validation:
- Run `bun run start` and test system theme detection
- Test switching system between light/dark modes
- Verify automatic theme switching works
- Check localStorage persistence
- Test theme mode selection (system/light/dark)

notes:
- Use references/solid/REFERENCE.md for SolidJS patterns
- Follow opencode theming implementation patterns
- Ensure proper cleanup in onCleanup
- Test with different system theme settings
- Verify theme updates are reactive
