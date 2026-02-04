# 48. Build User Preferences

meta:
  id: podcast-tui-app-48
  feature: podcast-tui-app
  priority: P1
  depends_on: [47]
  tags: [preferences, settings, solidjs]

objective:
- Create user preferences panel
- Implement theme selection
- Implement font size control
- Implement playback speed control
- Implement auto-download settings

deliverables:
- `src/components/PreferencesPanel.tsx` with preferences
- `src/components/ThemeSelector.tsx` with theme options
- `src/components/FontSelector.tsx` with font size options
- `src/components/AutoDownload.tsx` with auto-download settings

steps:
- Create `src/components/PreferencesPanel.tsx`:
  - Preferences sections
  - Navigation between preferences
  - Save/Cancel buttons
- Create `src/components/ThemeSelector.tsx`:
  - Theme options (light, dark, terminal)
  - Preview theme
  - Select theme
- Create `src/components/FontSelector.tsx`:
  - Font size options (small, medium, large)
  - Preview font size
  - Select font size
- Create `src/components/AutoDownload.tsx`:
  - Auto-download episodes
  - Download after playback
  - Download schedule
  - Storage limit warning

tests:
- Unit: Test theme selector
- Unit: Test font selector
- Unit: Test auto-download settings
- Integration: Test preferences save/load

acceptance_criteria:
- Preferences display correctly
- Theme selection works
- Font size selection works
- Auto-download settings work
- Preferences persist

validation:
- Run application and navigate to preferences
- Change theme and verify
- Change font size and verify
- Test auto-download settings
- Restart app and verify preferences

notes:
- Use localStorage for preferences
- Theme: Terminal colors (green/amber on black)
- Font size: Small (12px), Medium (14px), Large (16px)
- Auto-download: Download completed episodes
- Add preferences to settings screen
- Save preferences on change
- Reset to defaults button
