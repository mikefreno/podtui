# 63. Add Tokyo Night Theme

meta:
  id: podcast-tui-app-63
  feature: podcast-tui-app
  priority: P1
  depends_on: [59]
  tags: [theming, tokyo-night, solidjs, modern]

objective:
- Implement Tokyo Night theme for the podcast TUI
- Provide modern, vibrant color scheme
- Ensure good contrast and readability
- Support both dark and light variants

deliverables:
- `/src/themes/themes/tokyo-night.ts` - Tokyo Night theme definition
- `/src/themes/themes/tokyo-night-day.ts` - Light mode Tokyo Night
- `/src/themes/themes/tokyo-night-night.ts` - Dark mode Tokyo Night
- Updated `/src/themes/themes/index.ts` to export Tokyo Night themes

steps:
- Research and implement Tokyo Night theme color palette
- Define all color tokens (background, foreground, primary, secondary, etc.)
- Create Tokyo Night Night (dark) theme
- Create Tokyo Night Day (light) theme
- Ensure proper color contrast for accessibility
- Add Tokyo Night to theme registry

tests:
- Unit: Verify Tokyo Night theme colors are defined
- Unit: Test Tokyo Night Night renders correctly
- Unit: Test Tokyo Night Day renders correctly
- Visual: Verify Tokyo Night colors are visually appealing

acceptance_criteria:
- Tokyo Night Night theme works in dark terminals
- Tokyo Night Day theme works in light terminals
- Colors match official Tokyo Night design
- Theme is selectable from theme list

validation:
- Run `bun run build` to verify TypeScript compilation
- Test Tokyo Night theme manually in application
- Compare with official Tokyo Night color palette
- Check color harmony and contrast

notes:
- Tokyo Night Night is the recommended variant
- Include all standard Tokyo Night colors
- Use official color values from Tokyo Night repository
- Tokyo Night is popular for its modern, clean look
