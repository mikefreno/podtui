# 23. Implement XDG_CONFIG_HOME Directory Setup

meta:
  id: config-persistence-23
  feature: config-persistence
  priority: P1
  depends_on: []
  tags: [configuration, file-system, directory-setup]

objective:
- Implement XDG_CONFIG_HOME directory detection and creation
- Create application-specific config directory
- Handle XDG_CONFIG_HOME environment variable
- Provide fallback to ~/.config if XDG_CONFIG_HOME not set

deliverables:
- Config directory detection utility
- Directory creation logic
- Environment variable handling

steps:
1. Create `src/utils/config-dir.ts`
2. Implement XDG_CONFIG_HOME detection
3. Create fallback to HOME/.config
4. Create application-specific directory (podcast-tui-app)
5. Add directory creation with error handling

tests:
- Unit: Test XDG_CONFIG_HOME detection
- Unit: Test config directory creation
- Manual: Verify directory exists at expected path

acceptance_criteria:
- Config directory is created at correct path
- XDG_CONFIG_HOME is respected if set
- Falls back to ~/.config if XDG_CONFIG_HOME not set
- Directory is created with correct permissions

validation:
- Run app and check config directory exists
- Test with XDG_CONFIG_HOME=/custom/path
- Test with XDG_CONFIG_HOME not set
- Verify directory is created in both cases

notes:
- XDG_CONFIG_HOME default: ~/.config
- App name from package.json: podcast-tui-app
- Use Bun.file() and file operations for directory creation
- Handle permission errors gracefully
- Use mkdir -p for recursive creation
