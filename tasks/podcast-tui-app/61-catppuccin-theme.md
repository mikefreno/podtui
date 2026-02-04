# 61. Add Catppuccin Theme

meta:
  id: podcast-tui-app-61
  feature: podcast-tui-app
  priority: P1
  depends_on: [59]
  tags: [theming, catppuccin, solidjs, popular]

objective:
- Implement Catppuccin Mocha theme for the podcast TUI
- Provide beautiful, modern color scheme
- Ensure high contrast and readability
- Support both dark and light variants

deliverables:
- `/src/themes/themes/catppuccin.ts` - Catppuccin theme definition
- `/src/themes/themes/catppuccin-mocha.ts` - Dark mode Catppuccin
- `/src/themes/themes/catppuccin-latte.ts` - Light mode Catppuccin
- Updated `/src/themes/themes/index.ts` to export Catppuccin themes

steps:
- Research and implement Catppuccin Mocha color palette
- Define all color tokens (background, foreground, surface, primary, secondary, etc.)
- Create Catppuccin Mocha (dark) theme
- Create Catppuccin Latte (light) theme
- Ensure proper color contrast for accessibility
- Add Catppuccin to theme registry

tests:
- Unit: Verify Catppuccin theme colors are defined
- Unit: Test Catppuccin Mocha renders correctly
- Unit: Test Catppuccin Latte renders correctly
- Visual: Verify Catppuccin colors are visually appealing

acceptance_criteria:
- Catppuccin Mocha theme works in dark terminals
- Catppuccin Latte theme works in light terminals
- Colors match official Catppuccin design
- Theme is selectable from theme list

validation:
- Run `bun run build` to verify TypeScript compilation
- Test Catppuccin theme manually in application
- Compare with official Catppuccin color palette
- Check color harmony and contrast

notes:
- Catppuccin Mocha is the recommended dark theme
- Include all standard Catppuccin colors (latte, frappe, macchiato, mocha)
- Use official color values from Catppuccin repository
- Consider adding custom color variations
