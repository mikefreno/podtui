# 27. Implement Config File Backup on Update

meta:
  id: config-persistence-27
  feature: config-persistence
  priority: P2
  depends_on: [config-persistence-26]
  tags: [backup, data-safety, migration]

objective:
- Create backups of config files before updates
- Handle config file changes during app updates
- Provide rollback capability if needed

deliverables:
- Config backup utility
- Backup on config changes
- Config version history

steps:
1. Create config backup function
2. Implement backup on config save
3. Add config version history management
4. Test backup and restore scenarios
5. Add config file version display

tests:
- Unit: Test backup function
- Integration: Test backup on config save
- Manual: Test restore from backup

acceptance_criteria:
- Config files are backed up before updates
- Backup preserves data integrity
- Config version history is maintained

validation:
- Make config changes
- Verify backup created
- Restart app and check backup
- Test restore from backup

notes:
- Backup file naming: feeds.json.backup, themes.json.backup
- Keep last N backups (e.g., 5)
- Backup timestamp in filename
- Use atomic file operations
- Test with large config files
- Add config file size tracking
- Consider automatic cleanup of old backups
