# 16. Implement Download Progress Tracking [x]

meta:
  id: episode-downloads-16
  feature: episode-downloads
  priority: P2
  depends_on: [episode-downloads-15]
  tags: [progress, state-management, downloads]

objective:
- Track download progress for each episode
- Update download state in real-time
- Store download progress in persistent storage

deliverables:
- Download progress state in app store
- Progress update utility
- Integration with download utility

steps:
1. Add download state to app store
2. Update progress during download
3. Save progress to persistent storage
4. Handle download completion
5. Test progress tracking accuracy

tests:
- Unit: Test progress update logic
- Integration: Test progress tracking with download
- Persistence: Verify progress saved and restored

acceptance_criteria:
- Download progress is tracked accurately
- Progress updates in real-time
- Progress persists across app restarts

validation:
- Download a large file and watch progress
- Verify progress updates at intervals
- Restart app and verify progress restored

notes:
- Use existing progress store for episode playback
- Create separate download progress store
- Update progress every 1-2 seconds
- Handle download cancellation by resetting progress
- Store progress in XDG_CONFIG_HOME directory
