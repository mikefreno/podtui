# 53. Build File-Based Storage for Sync

meta:
  id: podcast-tui-app-53
  feature: podcast-tui-app
  priority: P1
  depends_on: [52]
  tags: [file-based-storage, sync, solidjs]

objective:
- Implement file-based storage for sync
- Store feeds and settings in files
- Implement backup functionality
- Implement restore functionality
- Handle file operations

deliverables:
- `src/utils/file-storage.ts` with file storage
- `src/utils/backup.ts` with backup functions
- `src/utils/restore.ts` with restore functions

steps:
- Create `src/utils/file-storage.ts`:
  - `saveFeedsToFile(feeds: Feed[]): Promise<void>`
  - `loadFeedsFromFile(): Promise<Feed[]>`
  - `saveSettingsToFile(settings: Settings): Promise<void>`
  - `loadSettingsFromFile(): Promise<Settings>`
  - Handle file operations and errors
- Create `src/utils/backup.ts`:
  - `createBackup(): Promise<string>`
  - `backupFeeds(feeds: Feed[]): string`
  - `backupSettings(settings: Settings): string`
  - Include all user data
  - Create backup directory
- Create `src/utils/restore.ts`:
  - `restoreFromBackup(backupData: string): Promise<void>`
  - `restoreFeeds(backupData: string): void`
  - `restoreSettings(backupData: string): void`
  - Validate backup data

tests:
- Unit: Test file storage functions
- Unit: Test backup functions
- Unit: Test restore functions

acceptance_criteria:
- File storage works correctly
- Backup creates valid files
- Restore loads data correctly
- File operations handle errors

validation:
- Run application and test file storage
- Create backup
- Restore from backup
- Test with different data sizes
- Test error cases

notes:
- Store files in `data/` directory
- Use JSON format for storage
- Include version info for compatibility
- Add file encryption option (optional)
- Test with large files
- Handle file permission errors
