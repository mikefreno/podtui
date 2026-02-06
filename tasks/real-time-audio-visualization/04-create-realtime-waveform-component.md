# 04. Create realtime waveform component

meta:
  id: real-time-audio-visualization-04
  feature: real-time-audio-visualization
  priority: P1
  depends_on: [real-time-audio-visualization-03]
  tags: [component, ui]

objective:
- Create a SolidJS component that displays real-time audio visualization
- Integrate audio-visualizer and audio-stream-reader
- Display frequency data as visual waveform bars

deliverables:
- src/components/RealtimeWaveform.tsx - Real-time waveform component
- src/components/RealtimeWaveform.test.tsx - Component tests

steps:
- Create RealtimeWaveform component:
  - Accept props: audioUrl, position, duration, isPlaying, onSeek, resolution
  - Initialize audio-visualizer with cavacore
  - Initialize audio-stream-reader for mpv backend
  - Create render loop that:
    - Reads audio samples from stream reader
    - Passes samples to cavacore execute()
    - Gets frequency data back
    - Maps frequency data to visual bars
    - Renders bars with appropriate colors
- Implement rendering logic:
  - Map frequency values to bar heights
  - Color-code bars based on intensity
  - Handle played vs unplayed portions
  - Support click-to-seek
- Create visual style:
  - Use terminal block characters for bars
  - Apply colors based on frequency bands (bass, mid, treble)
  - Add visual flair (gradients, glow effects if possible)
- Implement state management:
  - Track current frequency data
  - Track playback position
  - Handle component lifecycle (cleanup)
- Create unit tests:
  - Test component initialization
  - Test render loop
  - Test click-to-seek
  - Test cleanup

tests:
- Unit: Test component props
- Unit: Test frequency data mapping
- Unit: Test visual bar rendering
- Integration: Test with mock audio data
- Integration: Test with actual audio playback

acceptance_criteria:
- Component renders without errors
- Visual bars update in real-time during playback
- Frequency data is correctly calculated from audio samples
- Click-to-seek works
- Component cleans up resources properly
- Visual style matches design requirements

validation:
- Run: `bun test` for unit tests
- Manual: Play audio and verify visualization updates
- Manual: Test seeking and verify visualization follows
- Performance: Monitor frame rate and CPU usage

notes:
- Use SolidJS createEffect for reactive updates
- Keep render loop efficient to maintain 60fps
- Consider debouncing if processing is too heavy
- May need to adjust sample rate for performance
- Visual style should complement existing MergedWaveform design
