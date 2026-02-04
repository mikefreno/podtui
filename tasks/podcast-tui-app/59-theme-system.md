# 59. Create Theme System Architecture

meta:
  id: podcast-tui-app-59
  feature: podcast-tui-app
  priority: P1
  depends_on: [09]
  tags: [theming, architecture, solidjs, design-system]

objective:
- Design and implement a flexible theme system architecture
- Support multiple color themes (Catppuccin, Gruvbox, Tokyo, Nord, custom)
- Provide theme switching capabilities
- Ensure theme persistence across sessions
- Define theme properties (colors, fonts, spacing, borders)

deliverables:
- `/src/themes/types.ts` - Theme type definitions
- `/src/themes/theme.ts` - Theme system core implementation
- `/src/themes/themes/` - Directory with theme files
- `/src/themes/default.ts` - Default system theme
- `/src/themes/hooks.ts` - Theme hooks (useTheme, useThemeColor)

steps:
- Define `Theme` interface with properties: name, colors, fonts, spacing, borders
- Create theme color palettes (background, foreground, primary, secondary, accent, etc.)
- Implement `ThemeManager` class to handle theme loading, switching, and persistence
- Create `useTheme` hook for React/Solid components to access current theme
- Implement `useThemeColor` hook for accessing specific theme colors
- Add theme persistence using localStorage or file-based storage
- Export theme utilities for programmatic theme access

tests:
- Unit: Test theme loading from JSON file
- Unit: Test theme switching updates current theme
- Unit: Test theme persistence saves/loads correctly
- Integration: Verify components update when theme changes

acceptance_criteria:
- Theme system can load multiple theme definitions
- Theme switching works instantly across all components
- Theme preferences persist across application restarts
- Theme colors are accessible via hooks
- Theme manager handles errors gracefully

validation:
- Run `bun run build` to verify TypeScript compilation
- Test theme switching manually in application
- Verify localStorage/file storage works
- Check all theme colors render correctly

notes:
- Theme files should be JSON or TypeScript modules
- Use CSS variables or terminal color codes
- Consider dark/light mode compatibility
- Themes should be easily extensible
