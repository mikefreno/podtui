# 22. Add Backup/Restore Functionality

meta:
  id: podcast-tui-app-22
  feature: podcast-tui-app
  priority: P1
  depends_on: [21]
  tags: [backup-restore, sync, data-protection, solidjs]

objective:
- Implement backup functionality for all user data
- Implement restore functionality
- Create scheduled backups
- Add backup management UI

deliverables:
- `src/utils/backup.ts` with backup functions
- `src/utils/restore.ts` with restore functions
- `src/components/BackupManager.tsx` with backup UI
- `src/components/ScheduledBackups.tsx` with backup settings

steps:
- Create `src/utils/backup.ts`:
  - `createBackup(): Promise<string>`
  - `backupFeeds(feeds: Feed[]): string`
  - `backupSettings(settings: Settings): string`
  - Include all user data
- Create `src/utils/restore.ts`:
  - `restoreFromBackup(backupData: string): Promise<void>`
  - `restoreFeeds(backupData: string): void`
  - `restoreSettings(backupData: string): void`
  - Validate backup data
- Create `src/components/BackupManager.tsx`:
  - List of backup files
  - Restore button
  - Delete backup button
  - Create new backup button
- Create `src/components/ScheduledBackups.tsx`:
  - Enable/disable scheduled backups
  - Backup interval selection
  - Last backup time display
  - Manual backup button

tests:
- Unit: Test backup creates valid files
- Unit: Test restore loads data correctly
- Unit: Test backup validation
- Integration: Test backup/restore workflow

acceptance_criteria:
- Backup creates complete backup file
- Restore loads all data correctly
- Scheduled backups work as configured
- Backup files can be managed

validation:
- Run application and create backup
- Restore from backup
- Test scheduled backups
- Verify data integrity

notes:
- Backup file format: JSON with timestamp
- Include version info for compatibility
- Store backups in `backups/` directory
- Add backup encryption option (optional)
- Test with large data sets
