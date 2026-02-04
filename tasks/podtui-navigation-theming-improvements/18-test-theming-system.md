# 18. Test Theming System with All Modes

meta:
  id: podtui-navigation-theming-improvements-18
  feature: podtui-navigation-theming-improvements
  priority: P2
  depends_on: [podtui-navigation-theming-improvements-15, podtui-navigation-theming-improvements-16, podtui-navigation-theming-improvements-17]
  tags: [testing, theming, integration]

objective:
- Test theming system with all modes (system/light/dark)
- Verify theme tokens work correctly
- Ensure theming is consistent across all components
- Test theme persistence and system theme detection

deliverables:
- Theming system test results
- Theme token test cases
- Theme consistency report

steps:
- Create test cases for theming system:
  - Test system theme mode
  - Test light theme mode
  - Test dark theme mode
  - Test theme persistence
  - Test system theme detection
  - Test theme selection
  - Test color scheme switching
- Run `bun run start` and perform all test cases
- Test theme tokens in all components:
  - Background colors
  - Text colors
  - Border colors
  - Interactive colors
  - Color tokens (success, warning, error, etc.)
  - Layer navigation colors
- Test theme changes are reactive
- Test theme tokens work in all terminals
- Verify theme consistency across all components
- Document any issues

tests:
- Unit: Test theme tokens with mocked themes
- Integration: Test theming in all components and modes

acceptance_criteria:
- Theming system works correctly in all modes
- Theme tokens work correctly in all components
- Theme changes are reactive
- Theme persistence works correctly
- System theme detection works correctly
- Theme consistency is maintained across all components
- All test cases pass

validation:
- Run `bun run start` and perform all test cases
- Test all theme modes (system/light/dark)
- Test theme selection and color scheme switching
- Verify theme persistence
- Test system theme detection
- Check console for errors
- Verify theme consistency across all components
- Document all test results

notes:
- Test with different terminal sizes
- Test with different color schemes
- Test rapid theme changes
- Verify theme updates are reactive
- Test all components with all themes
- Ensure accessibility standards are met
