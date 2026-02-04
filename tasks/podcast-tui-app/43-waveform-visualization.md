# 42. Implement Playback Controls

meta:
  id: podcast-tui-app-42
  feature: podcast-tui-app
  priority: P0
  depends_on: [41]
  tags: [playback, controls, audio, solidjs]

objective:
- Implement playback controls (play/pause, skip, progress)
- Create control buttons
- Add keyboard shortcuts
- Handle playback state

deliverables:
- `src/components/PlaybackControls.tsx` with control buttons
- `src/utils/playback.ts` with playback logic
- `src/hooks/usePlayback.ts` with playback hook

steps:
- Create `src/utils/playback.ts`:
  - `playAudio(audioUrl: string): void`
  - `pauseAudio(): void`
  - `skipForward(): void`
  - `skipBackward(): void`
  - `setPlaybackSpeed(speed: number): void`
  - Handle audio player integration
- Create `src/hooks/usePlayback.ts`:
  - `createSignal` for playback state
  - Methods: play, pause, seek, setSpeed
  - Handle audio events (timeupdate, ended)
- Create `src/components/PlaybackControls.tsx`:
  - Play/Pause button
  - Previous/Next episode buttons
  - Volume control (slider)
  - Speed control (1x, 1.25x, 1.5x, 2x)
  - Keyboard shortcuts (space, arrows)

tests:
- Unit: Test playback logic
- Unit: Test playback hook
- Integration: Test playback controls

acceptance_criteria:
- Play/pause button works
- Skip forward/backward works
- Speed control works
- Volume control works
- Keyboard shortcuts work

validation:
- Run application and test playback
- Press play/pause
- Test skip buttons
- Change playback speed
- Test keyboard shortcuts

notes:
- Audio integration: Trigger system player or use Web Audio API
- Use Web Audio API for waveform
- Handle audio errors
- Add loading state during playback
- Store playback speed preference
- Support keyboard shortcuts:
  - Space: Play/Pause
  - Arrow Right: Skip forward
  - Arrow Left: Skip backward
  - Arrow Up: Volume up
  - Arrow Down: Volume down
