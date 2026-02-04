# 65. Implement Custom Theme Editor

meta:
  id: podcast-tui-app-65
  feature: podcast-tui-app
  priority: P2
  depends_on: [59]
  tags: [theming, editor, custom, solidjs]

objective:
- Build a UI for creating and editing custom themes
- Allow users to modify color palettes
- Provide live preview of theme changes
- Save custom themes to storage

deliverables:
- `/src/components/ThemeEditor.tsx` - Theme editor component
- `/src/components/ThemePreview.tsx` - Live theme preview component
- `/src/components/ColorPicker.tsx` - Custom color picker component
- `/src/store/theme-editor.ts` - Theme editor state management
- Updated settings screen to include theme editor

steps:
- Create ThemeEditor component with color palette editor
- Implement ColorPicker component for selecting theme colors
- Create ThemePreview component showing live theme changes
- Build form controls for editing all theme properties
- Add save functionality for custom themes
- Implement delete functionality for custom themes
- Add validation for theme color values
- Update settings screen to show theme editor

tests:
- Unit: Test theme editor saves custom themes correctly
- Unit: Test color picker updates theme colors
- Unit: Test theme preview updates in real-time
- Integration: Test custom theme can be loaded

acceptance_criteria:
- Theme editor allows editing all theme colors
- Custom theme can be saved and loaded
- Live preview shows theme changes in real-time
- Custom themes persist across sessions
- Invalid color values are rejected

validation:
- Run `bun run build` to verify TypeScript compilation
- Test theme editor manually in application
- Verify custom themes save/load correctly
- Check live preview works smoothly

notes:
- Use existing theme type definitions
- Provide preset color palettes for quick selection
- Consider adding theme templates
- Ensure editor works on small terminal sizes
