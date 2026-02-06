# 07. Create Merged Progress-Waveform Component

meta:
  id: merged-waveform-07
  feature: merged-waveform
  priority: P2
  depends_on: [merged-waveform-06]
  tags: [ui, waveform, component]

objective:
- Design and implement a single component that shows progress bar and waveform
- Component starts as progress bar, expands to waveform when playing
- Provide smooth transitions between states

deliverables:
- MergedWaveform component
- State management for progress vs waveform display
- Visual styling for progress bar and waveform

steps:
1. Create `src/components/MergedWaveform.tsx`
2. Design component state machine (progress bar → waveform)
3. Implement progress bar visualization
4. Add waveform expansion animation
5. Style progress bar and waveform with theme colors

tests:
- Unit: Test component state transitions
- Integration: Test component in Player
- Visual: Verify smooth expansion animation

acceptance_criteria:
- Component displays progress bar when paused
- Component smoothly expands to waveform when playing
- Visual styles match theme and existing UI

validation:
- Test with paused and playing states
- Verify expansion is smooth and visually appealing
- Check theme color integration

notes:
- Use existing Waveform component as base
- Add CSS transitions for smooth expansion
- Keep component size manageable (fit in progress bar area)
- Consider responsive to terminal width changes
