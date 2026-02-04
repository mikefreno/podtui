# 64. Add Nord Theme

meta:
  id: podcast-tui-app-64
  feature: podcast-tui-app
  priority: P1
  depends_on: [59]
  tags: [theming, nord, solidjs, minimal]

objective:
- Implement Nord theme for the podcast TUI
- Provide clean, minimal color scheme
- Ensure good contrast and readability
- Support both dark and light variants

deliverables:
- `/src/themes/themes/nord.ts` - Nord theme definition
- `/src/themes/themes/nord-dark.ts` - Dark mode Nord
- `/src/themes/themes/nord-light.ts` - Light mode Nord
- Updated `/src/themes/themes/index.ts` to export Nord themes

steps:
- Research and implement Nord theme color palette
- Define all color tokens (background, foreground, primary, secondary, etc.)
- Create Nord Dark theme
- Create Nord Light theme
- Ensure proper color contrast for accessibility
- Add Nord to theme registry

tests:
- Unit: Verify Nord theme colors are defined
- Unit: Test Nord Dark renders correctly
- Unit: Test Nord Light renders correctly
- Visual: Verify Nord colors are visually appealing

acceptance_criteria:
- Nord Dark theme works in dark terminals
- Nord Light theme works in light terminals
- Colors match official Nord design
- Theme is selectable from theme list

validation:
- Run `bun run build` to verify TypeScript compilation
- Test Nord theme manually in application
- Compare with official Nord color palette
- Check color harmony and contrast

notes:
- Nord Dark is the recommended variant
- Include all standard Nord colors
- Use official color values from Nord repository
- Nord is popular for its minimalist, clean aesthetic
