# 05. Update Player component to use realtime visualization

meta:
  id: real-time-audio-visualization-05
  feature: real-time-audio-visualization
  priority: P1
  depends_on: [real-time-audio-visualization-04]
  tags: [integration, player]

objective:
- Replace static waveform display with real-time visualization
- Update Player.tsx to use RealtimeWaveform component
- Ensure seamless transition and proper state management

deliverables:
- Updated src/components/Player.tsx
- Updated src/components/MergedWaveform.tsx (optional, for fallback)
- Documentation of changes

steps:
- Update Player.tsx:
  - Import RealtimeWaveform component
  - Replace MergedWaveform with RealtimeWaveform
  - Pass same props (audioUrl, position, duration, isPlaying, onSeek)
  - Remove audioUrl from props if no longer needed
- Test with different audio formats
- Add fallback handling:
  - If realtime visualization fails, show static waveform
  - Graceful degradation for systems without FFTW
- Update component documentation
- Test all player controls work with new visualization
- Verify keyboard shortcuts still work
- Test seek, pause, resume, volume, speed controls

tests:
- Unit: Test Player with RealtimeWaveform
- Integration: Test complete playback flow
- Integration: Test seek functionality
- Integration: Test pause/resume
- Integration: Test volume and speed changes
- Integration: Test with different audio formats
- Manual: Verify all player features work correctly

acceptance_criteria:
- Player displays real-time visualization during playback
- All player controls work correctly
- Seek functionality works with visualization
- Graceful fallback for systems without FFTW
- No regression in existing functionality
- Visual style matches design requirements

validation:
- Run: `bun run build` to verify compilation
- Run: `bun test` for integration tests
- Manual: Play various audio files
- Manual: Test all keyboard shortcuts
- Performance: Monitor frame rate and CPU usage

notes:
- Keep MergedWaveform as fallback option
- Consider showing a loading state while visualizer initializes
- May need to handle the case where mpv doesn't support audio pipe
- The visualizer should integrate smoothly with existing Player layout
- Consider adding a toggle to switch between static and realtime visualization
