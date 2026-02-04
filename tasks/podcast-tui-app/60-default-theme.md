# 60. Implement Default Theme (System Terminal)

meta:
  id: podcast-tui-app-60
  feature: podcast-tui-app
  priority: P1
  depends_on: [59]
  tags: [theming, default, solidjs, terminal]

objective:
- Implement the default system terminal theme
- Define colors matching common terminal environments
- Ensure good readability and contrast
- Support both light and dark terminal modes

deliverables:
- `/src/themes/themes/default.ts` - Default theme definition
- `/src/themes/themes/default-light.ts` - Light mode theme
- `/src/themes/themes/default-dark.ts` - Dark mode theme
- Updated `/src/themes/theme.ts` to load default theme

steps:
- Define default color palette for system terminals
- Create light mode theme with standard terminal colors
- Create dark mode theme with standard terminal colors
- Ensure proper contrast ratios for readability
- Test theme in both light and dark terminal environments
- Export default theme as fallback

tests:
- Unit: Verify default theme colors are defined
- Unit: Test theme renders correctly in light mode
- Unit: Test theme renders correctly in dark mode
- Visual: Verify text contrast meets accessibility standards

acceptance_criteria:
- Default theme works in light terminal mode
- Default theme works in dark terminal mode
- Colors have good readability and contrast
- Theme is used as fallback when no theme selected

validation:
- Run `bun run build` to verify TypeScript compilation
- Test in light terminal (e.g., iTerm2, Terminal.app)
- Test in dark terminal (e.g., Kitty, Alacritty)
- Check color contrast visually

notes:
- Use standard terminal color codes (ANSI escape codes)
- Consider common terminal themes (Solarized, Dracula, etc.)
- Test on multiple terminal emulators
- Document terminal requirements
