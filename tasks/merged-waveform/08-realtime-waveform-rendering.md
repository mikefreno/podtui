# 08. Implement Real-Time Waveform Rendering During Playback

meta:
  id: merged-waveform-08
  feature: merged-waveform
  priority: P2
  depends_on: [merged-waveform-07]
  tags: [audio, realtime, rendering]

objective:
- Update waveform in real-time during audio playback
- Highlight waveform based on current playback position
- Sync waveform with audio backend position updates

deliverables:
- Real-time waveform update logic
- Playback position highlighting
- Integration with audio backend position tracking

steps:
1. Subscribe to audio backend position updates
2. Update waveform data points based on playback position
3. Implement playback position highlighting
4. Add animation for progress indicator
5. Test synchronization with audio playback

tests:
- Integration: Test waveform sync with audio playback
- Performance: Measure real-time update overhead
- Visual: Verify progress highlighting matches audio position

acceptance_criteria:
- Waveform updates in real-time during playback
- Playback position is accurately highlighted
- No lag or desynchronization with audio

validation:
- Play audio and watch waveform update
- Verify progress bar matches audio position
- Test with different playback speeds

notes:
- Use existing audio position polling in `useAudio.ts`
- Update waveform every ~100ms for smooth visuals
- Consider reducing waveform resolution during playback for performance
- Ensure highlighting doesn't flicker
