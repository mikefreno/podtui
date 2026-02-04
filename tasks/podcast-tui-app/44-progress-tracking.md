# 43. Build ASCII Waveform Visualization

meta:
  id: podcast-tui-app-43
  feature: podcast-tui-app
  priority: P0
  depends_on: [42]
  tags: [waveform, visualization, ascii, solidjs]

objective:
- Create ASCII waveform visualization
- Generate waveform from audio data
- Display waveform in player
- Handle click to seek

deliverables:
- `src/components/Waveform.tsx` with waveform display
- `src/utils/waveform.ts` with waveform generation
- `src/components/WaveformProgress.tsx` with progress overlay

steps:
- Create `src/utils/waveform.ts`:
  - `generateWaveform(audioUrl: string): Promise<string>`
  - Fetch audio data
  - Analyze audio frequencies
  - Convert to ASCII characters
  - Return ASCII waveform string
- Create `src/components/Waveform.tsx`:
  - Display ASCII waveform
  - Color-coded for played/paused
  - Click to seek to position
  - Handle terminal width
- Create `src/components/WaveformProgress.tsx`:
  - Progress overlay on waveform
  - Show current position
  - Highlight current segment

tests:
- Unit: Test waveform generation
- Unit: Test waveform display
- Integration: Test click to seek

acceptance_criteria:
- Waveform displays correctly
- Waveform generated from audio
- Color-coded for played/paused
- Clicking waveform seeks to position

validation:
- Run application and play an episode
- Verify waveform displays
- Check waveform colors
- Test seeking by clicking waveform

notes:
- ASCII waveform: Use `#` for peaks, `.` for valleys
- Use Web Audio API for waveform generation
- Cache waveform data for performance
- Handle large audio files
- Use frame buffer for drawing
- Color scheme: Green for played, Gray for paused
