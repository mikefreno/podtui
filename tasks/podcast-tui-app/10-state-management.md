# 10. Build Settings Screen and Preferences

meta:
  id: podcast-tui-app-10
  feature: podcast-tui-app
  priority: P1
  depends_on: [09]
  tags: [settings, preferences, solidjs, opentui]

objective:
- Create settings screen component
- Add source management UI
- Build user preferences panel
- Implement data persistence

deliverables:
- `src/components/SettingsScreen.tsx` with settings UI
- `src/components/SourceManager.tsx` with source management
- `src/components/PreferencesPanel.tsx` with user preferences
- `src/utils/persistence.ts` with localStorage utilities

steps:
- Create `src/components/SettingsScreen.tsx`:
  - Settings menu with sections
  - Navigation between settings sections
  - Save/Cancel buttons
- Create `src/components/SourceManager.tsx`:
  - List of enabled sources
  - Add source button
  - Remove source button
  - Enable/disable toggle
- Create `src/components/PreferencesPanel.tsx`:
  - Theme selection (light/dark)
  - Font size control
  - Playback speed control
  - Auto-download settings
- Create `src/utils/persistence.ts`:
  - `savePreference(key, value)`
  - `loadPreference(key)`
  - `saveFeeds(feeds)`
  - `loadFeeds()`
  - `saveSettings(settings)`
  - `loadSettings()`
- Add settings screen to "Settings" navigation tab

tests:
- Unit: Test persistence functions
- Unit: Test source management
- Integration: Test settings screen navigation
- Integration: Test preferences save/load

acceptance_criteria:
- Settings screen displays all sections
- Source management adds/removes sources
- Preferences save correctly
- Data persists across sessions
- Settings screen is accessible

validation:
- Run application and navigate to "Settings"
- Test source management
- Change preferences and verify save
- Restart app and verify preferences persist

notes:
- Use localStorage for simple persistence
- Settings are application-level, not user-specific
- Source management requires API keys if needed
- Preferences are per-user
- Add error handling for persistence failures
