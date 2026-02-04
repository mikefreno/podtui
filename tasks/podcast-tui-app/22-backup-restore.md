# 21. Build Sync Status Indicator

meta:
  id: podcast-tui-app-21
  feature: podcast-tui-app
  priority: P1
  depends_on: [20]
  tags: [status-indicator, sync, ui, solidjs]

objective:
- Create sync status indicator component
- Display sync state (idle, syncing, complete, error)
- Show sync progress
- Provide sync status in settings

deliverables:
- `src/components/SyncStatus.tsx` with status indicator
- `src/components/SyncProgress.tsx` with progress bar
- `src/components/SyncError.tsx` with error display

steps:
- Create `src/components/SyncStatus.tsx`:
  - Display current sync state
  - Show status icon (spinner, check, error)
  - Show status message
  - Auto-update based on state
- Create `src/components/SyncProgress.tsx`:
  - Progress bar visualization
  - Percentage display
  - Step indicators
  - Animation
- Create `src/components/SyncError.tsx`:
  - Error message display
  - Retry button
  - Error details (expandable)
- Add sync status to settings screen

tests:
- Unit: Test status indicator updates correctly
- Unit: Test progress bar visualization
- Unit: Test error display

acceptance_criteria:
- Status indicator shows correct state
- Progress bar updates during sync
- Error message is displayed on errors
- Status persists across sync operations

validation:
- Run application and test sync operations
- Trigger export/import
- Verify status indicator updates
- Test error cases

notes:
- Use SolidJS signals for state
- Status states: idle, syncing, complete, error
- Use ASCII icons for status indicators
- Add animation for syncing state
- Make status component reusable
