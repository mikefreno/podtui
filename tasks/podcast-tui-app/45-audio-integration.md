# 44. Add Progress Tracking and Seek

meta:
  id: podcast-tui-app-44
  feature: podcast-tui-app
  priority: P0
  depends_on: [43]
  tags: [progress, tracking, seek, solidjs]

objective:
- Track playback progress
- Save progress to storage
- Implement seek functionality
- Display progress bar

deliverables:
- `src/utils/progress.ts` with progress tracking
- `src/hooks/useProgress.ts` with progress hook
- `src/components/ProgressBar.tsx` with progress bar

steps:
- Create `src/utils/progress.ts`:
  - `saveProgress(episodeId: string, position: number, duration: number): void`
  - `loadProgress(episodeId: string): Progress | null`
  - `updateProgress(episodeId: string, position: number): void`
  - Handle progress persistence
- Create `src/hooks/useProgress.ts`:
  - `createSignal` for progress
  - Update progress on timeupdate
  - Save progress periodically
  - Load progress on episode change
- Create `src/components/ProgressBar.tsx`:
  - Progress bar visualization
  - Percentage display
  - Time display (current/total)
  - Click to seek

tests:
- Unit: Test progress tracking functions
- Unit: Test progress hook
- Integration: Test progress bar

acceptance_criteria:
- Progress saved correctly
- Progress loaded correctly
- Seek works via progress bar
- Progress persists across sessions

validation:
- Run application and play episode
- Seek to different positions
- Stop and restart
- Verify progress saved
- Restart app and verify progress loaded

notes:
- Save progress to localStorage
- Auto-save every 30 seconds
- Save on episode change
- Save on pause
- Don't save on completion
- Load progress when starting episode
- Display progress bar in player
