# 27. Create Sync-Only User Profile

meta:
  id: podcast-tui-app-27
  feature: podcast-tui-app
  priority: P2
  depends_on: [26]
  tags: [profile, sync, user-info, solidjs]

objective:
- Create user profile component for sync-only users
- Display user information
- Show sync status
- Provide profile management options

deliverables:
- `src/components/SyncProfile.tsx` with user profile
- `src/components/SyncStatus.tsx` with sync status
- `src/components/ProfileSettings.tsx` with profile settings

steps:
- Create `src/components/SyncProfile.tsx`:
  - User avatar/icon
  - User name display
  - Email display
  - Sync status indicator
  - Profile actions
- Create `src/components/SyncStatus.tsx`:
  - Sync status (last sync time)
  - Sync method (file-based)
  - Sync frequency
  - Sync history
- Create `src/components/ProfileSettings.tsx`:
  - Edit profile
  - Change password
  - Manage sync settings
  - Export data
- Add profile to settings screen

tests:
- Unit: Test profile displays correctly
- Unit: Test sync status updates
- Integration: Test profile settings

acceptance_criteria:
- Profile displays user information
- Sync status is shown
- Profile settings work correctly
- Profile is accessible from settings

validation:
- Run application and navigate to profile
- View profile information
- Test profile settings
- Verify sync status

notes:
- Profile for sync-only users
- No authentication required
- Profile data stored in localStorage
- Sync status shows last sync time
- Profile is optional
