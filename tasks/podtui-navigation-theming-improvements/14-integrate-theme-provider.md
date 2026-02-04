# 14. Integrate Theme Provider into App Component

meta:
  id: podtui-navigation-theming-improvements-14
  feature: podtui-navigation-theming-improvements
  priority: P2
  depends_on: [podtui-navigation-theming-improvements-09, podtui-navigation-theming-improvements-13]
  tags: [integration, theming, app]

objective:
- Integrate theme provider into App component
- Apply theme tokens to all components
- Ensure theme changes are reactive

deliverables:
- Updated App.tsx with theme provider
- Theme application logic
- Theme integration tests

steps:
- Read references/solid/REFERENCE.md for SolidJS patterns
- Wrap App component with ThemeProvider
- Implement theme application in Layout component
- Apply theme tokens to all components:
  - TabNavigation (active tab background)
  - Navigation (footer navigation)
  - DiscoverPage (background, borders, text colors)
  - FeedList (background, borders, text colors)
  - SettingsScreen (background, borders, text colors)
  - SourceManager (background, borders, text colors)
  - All other components
- Update theme tokens usage in src/constants/themes.ts
- Test theme application in all components
- Test theme changes are reactive

tests:
- Unit: Test theme provider integration
- Integration: Test theme changes in all components

acceptance_criteria:
- ThemeProvider is integrated into App component
- Theme tokens are applied to all components
- Theme changes are reactive
- All components render correctly with theme tokens
- No console errors related to theming

validation:
- Run `bun run start` and verify theme is applied
- Test theme selection and color scheme switching
- Test system theme detection
- Verify all components use theme tokens
- Check console for errors

notes:
- Use references/solid/REFERENCE.md for SolidJS patterns
- Follow opencode theming implementation patterns
- Ensure theme tokens are used consistently
- Test theme changes in all components
- Verify no hardcoded colors remain
