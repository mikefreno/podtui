# 25. Refactor Theme Persistence to JSON File

meta:
  id: config-persistence-25
  feature: config-persistence
  priority: P1
  depends_on: [config-persistence-23]
  tags: [persistence, themes, file-io]

objective:
- Move theme persistence from localStorage to JSON file
- Load custom themes from XDG_CONFIG_HOME directory
- Save custom themes to JSON file
- Maintain backward compatibility

deliverables:
- Themes JSON file I/O functions
- Updated theme persistence
- Migration from localStorage

steps:
1. Create `src/utils/themes-persistence.ts`
2. Implement loadThemesFromFile() function
3. Implement saveThemesToFile() function
4. Update theme store to use file-based persistence
5. Add migration from localStorage to file

tests:
- Unit: Test file I/O functions
- Integration: Test theme persistence with file
- Migration: Test migration from localStorage

acceptance_criteria:
- Custom themes are loaded from JSON file
- Custom themes are saved to JSON file
- Backward compatibility maintained

validation:
- Start app with no theme file
- Load custom theme
- Verify theme saved to file
- Restart app and verify theme loaded
- Test migration from localStorage

notes:
- File path: XDG_CONFIG_HOME/podcast-tui-app/themes.json
- Use JSON.stringify/parse for serialization
- Handle file not found (use default themes)
- Handle file write errors
- Add timestamp to file for versioning
- Maintain theme type structure
- Include all theme files in directory
