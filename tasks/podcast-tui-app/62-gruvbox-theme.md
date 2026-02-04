# 62. Add Gruvbox Theme

meta:
  id: podcast-tui-app-62
  feature: podcast-tui-app
  priority: P1
  depends_on: [59]
  tags: [theming, gruvbox, solidjs, retro]

objective:
- Implement Gruvbox Dark theme for the podcast TUI
- Provide warm, nostalgic color scheme
- Ensure good contrast and readability
- Support both dark and light variants

deliverables:
- `/src/themes/themes/gruvbox.ts` - Gruvbox theme definition
- `/src/themes/themes/gruvbox-dark.ts` - Dark mode Gruvbox
- `/src/themes/themes/gruvbox-light.ts` - Light mode Gruvbox
- Updated `/src/themes/themes/index.ts` to export Gruvbox themes

steps:
- Research and implement Gruvbox Dark theme color palette
- Define all color tokens (background, foreground, primary, secondary, etc.)
- Create Gruvbox Dark theme
- Create Gruvbox Light theme
- Ensure proper color contrast for accessibility
- Add Gruvbox to theme registry

tests:
- Unit: Verify Gruvbox theme colors are defined
- Unit: Test Gruvbox Dark renders correctly
- Unit: Test Gruvbox Light renders correctly
- Visual: Verify Gruvbox colors are visually appealing

acceptance_criteria:
- Gruvbox Dark theme works in dark terminals
- Gruvbox Light theme works in light terminals
- Colors match official Gruvbox design
- Theme is selectable from theme list

validation:
- Run `bun run build` to verify TypeScript compilation
- Test Gruvbox theme manually in application
- Compare with official Gruvbox color palette
- Check color harmony and contrast

notes:
- Gruvbox Dark is the recommended variant
- Include all standard Gruvbox colors (hard, soft, light)
- Use official color values from Gruvbox repository
- Gruvbox is popular among developers for its warmth
