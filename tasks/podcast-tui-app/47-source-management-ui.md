# 46. Create Settings Screen

meta:
  id: podcast-tui-app-46
  feature: podcast-tui-app
  priority: P1
  depends_on: [45]
  tags: [settings, screen, solidjs, opentui]

objective:
- Create settings screen component
- Implement settings navigation
- Display all settings sections
- Save/apply settings

deliverables:
- `src/components/SettingsScreen.tsx` with settings UI
- `src/components/SettingsNavigation.tsx` with settings menu
- `src/components/SettingsContent.tsx` with settings content

steps:
- Create `src/components/SettingsNavigation.tsx`:
  - Settings menu with sections
  - Navigation between sections
  - Active section highlighting
  - Keyboard navigation
- Create `src/components/SettingsContent.tsx`:
  - Feed settings section
  - Player settings section
  - Sync settings section
  - Appearance settings section
  - Account settings section
- Create `src/components/SettingsScreen.tsx`:
  - Combine navigation and content
  - Save/Cancel buttons
  - Reset to defaults button

tests:
- Unit: Test SettingsNavigation displays correctly
- Unit: Test SettingsContent sections
- Integration: Test settings navigation

acceptance_criteria:
- Settings screen displays all sections
- Navigation between sections works
- Settings save correctly
- Settings persist

validation:
- Run application and navigate to "Settings"
- Navigate between settings sections
- Change settings
- Verify settings persist
- Test reset to defaults

notes:
- Use SolidJS signals for settings state
- Settings sections:
  - Feeds: Source management, auto-download
  - Player: Playback speed, auto-play next
  - Sync: Backup frequency, sync method
  - Appearance: Theme, font size
  - Account: Login, sync profile
- Add keyboard shortcuts for navigation
- Save settings on change
- Reset to defaults button
