# 09. Create Theme Context Provider

meta:
  id: podtui-navigation-theming-improvements-09
  feature: podtui-navigation-theming-improvements
  priority: P2
  depends_on: []
  tags: [theming, implementation, solid-js]

objective:
- Create theme context provider based on opencode implementation
- Implement theme state management
- Provide theme tokens to all components

deliverables:
- Theme context provider component
- Theme state management hooks
- Theme provider integration

steps:
- Read opencode/packages/ui/src/theme/context.tsx for reference
- Create theme context using SolidJS createContext
- Design theme state structure (themeId, colorScheme, mode, etc.)
- Implement theme state management with signals
- Add theme selection and color scheme management functions
- Create ThemeProvider component
- Add theme persistence to localStorage
- Implement system theme detection
- Add theme change listeners
- Test theme context provider

tests:
- Unit: Test theme context provider with mocked state
- Integration: Test theme provider integration

acceptance_criteria:
- Theme context provider is created
- Theme state management works correctly
- Theme selection and color scheme management functions work
- Theme persistence to localStorage works
- System theme detection works
- Theme change listeners work
- Theme provider can be used to wrap App component

validation:
- Run `bun run start` and verify theme context provider works
- Test theme selection functionality
- Test color scheme switching
- Verify localStorage persistence
- Check system theme detection

notes:
- Use references/solid/REFERENCE.md for SolidJS patterns
- Follow opencode theming implementation patterns
- Use createSignal for reactive theme state
- Ensure proper cleanup in onCleanup
- Test with different theme configurations
