# 66. Add Theme Selector in Settings

meta:
  id: podcast-tui-app-66
  feature: podcast-tui-app
  priority: P1
  depends_on: [59, 60, 61, 62, 63, 64, 65]
  tags: [theming, settings, selector, solidjs]

objective:
- Add theme selection UI in settings screen
- Display all available themes (default, Catppuccin, Gruvbox, Tokyo, Nord, custom)
- Allow users to select and switch themes
- Show currently selected theme
- Persist theme preference

deliverables:
- `/src/components/ThemeSelector.tsx` - Theme selector component
- Updated `/src/components/SettingsScreen.tsx` to include theme selector
- Updated `/src/store/theme.ts` to handle theme preference persistence
- Theme selector in settings navigation

steps:
- Create ThemeSelector component with theme list
- Implement theme selection logic
- Display current theme with visual indicator
- Add theme descriptions or icons
- Integrate theme selector into Settings screen
- Save theme preference to storage
- Handle theme switching with instant updates
- Add keyboard navigation for theme list

tests:
- Unit: Test theme selector displays all themes
- Unit: Test theme selection updates current theme
- Unit: Test theme preference saves to storage
- Integration: Test theme switching works across all components

acceptance_criteria:
- Theme selector shows all available themes
- Users can select and switch themes
- Current theme is clearly indicated
- Theme preference persists across sessions
- Theme changes apply immediately to all components

validation:
- Run `bun run build` to verify TypeScript compilation
- Test theme selector manually in settings
- Verify theme preference saves/loads correctly
- Check theme applies to all UI components

notes:
- Use existing theme manager for theme switching
- Consider adding theme search/filter
- Show theme preview in selector if possible
- Ensure accessibility for keyboard navigation
