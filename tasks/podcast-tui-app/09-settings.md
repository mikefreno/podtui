# 09. Create Player UI with Waveform Visualization

meta:
  id: podcast-tui-app-09
  feature: podcast-tui-app
  priority: P0
  depends_on: [08]
  tags: [player, waveform, visualization, solidjs, opentui]

objective:
- Create player UI layout
- Implement playback controls (play/pause, skip, progress)
- Build ASCII waveform visualization
- Add progress tracking and seek functionality

deliverables:
- `src/components/Player.tsx` with player UI
- `src/components/PlaybackControls.tsx` with controls
- `src/components/Waveform.tsx` with ASCII waveform
- `src/utils/waveform.ts` with visualization logic

steps:
- Create `src/components/Player.tsx`:
  - Player header with episode info
  - Progress bar with seek functionality
  - Waveform visualization area
  - Playback controls
- Create `src/components/PlaybackControls.tsx`:
  - Play/Pause button
  - Previous/Next episode buttons
  - Volume control
  - Speed control
  - Keyboard shortcuts (space, arrows)
- Create `src/components/Waveform.tsx`:
  - ASCII waveform visualization
  - Click to seek
  - Color-coded for played/paused
  - Use frame buffer for drawing
- Create `src/utils/waveform.ts`:
  - Generate waveform data from audio
  - Convert to ASCII characters
  - Handle audio duration and position
- Add player to "Player" navigation tab

tests:
- Unit: Test waveform generation
- Unit: Test playback controls
- Integration: Test player UI displays correctly
- Integration: Test keyboard shortcuts work

acceptance_criteria:
- Player UI displays episode information
- Playback controls work (play/pause, skip)
- Waveform visualization shows audio waveform
- Progress bar updates during playback
- Clicking waveform seeks to position

validation:
- Run application and navigate to "Player"
- Select an episode to play
- Test playback controls
- Verify waveform visualization
- Test seeking by clicking waveform
- Test keyboard shortcuts

notes:
- ASCII waveform: Use `#` for peaks, `.` for valleys
- Audio integration: Trigger system player or use Web Audio API
- Waveform data needs to be cached for performance
- Use SolidJS `useTimeline` for animation
