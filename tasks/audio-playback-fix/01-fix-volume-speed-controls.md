# 01. Fix volume and speed controls in audio backends [x]

meta:
  id: audio-playback-fix-01
  feature: audio-playback-fix
  priority: P1
  depends_on: []
  tags: [implementation, backend-fix, testing-required]

objective:
- Fix non-functional volume and speed controls in audio player backends (mpv, ffplay, afplay)
- Implement proper error handling and validation for volume/speed commands
- Ensure commands are successfully received and applied by the audio player

deliverables:
- Fixed `MpvBackend.setVolume()` and `MpvBackend.setSpeed()` methods with proper IPC command validation
- Enhanced `AfplayBackend.setVolume()` and `AfplayBackend.setSpeed()` for runtime changes
- Added command response validation in all backends
- Unit tests for volume and speed control methods

steps:
- Step 1: Analyze current IPC implementation in MpvBackend (lines 206-223)
- Step 2: Implement proper response validation for setVolume and setSpeed IPC commands
- Step 3: Fix afplay backend to apply volume/speed changes at runtime (currently only on next play)
- Step 4: Add error handling and logging for failed volume/speed commands
- Step 5: Add unit tests in `src/utils/audio-player.test.ts` for volume/speed methods
- Step 6: Verify volume changes apply immediately and persist across playback
- Step 7: Verify speed changes apply immediately and persist across playback

tests:
- Unit:
  - Test MpvBackend.setVolume() sends correct IPC command and receives valid response
  - Test MpvBackend.setSpeed() sends correct IPC command and receives valid response
  - Test AfplayBackend.setVolume() applies volume immediately
  - Test AfplayBackend.setSpeed() applies speed immediately
  - Test volume clamp values (0-1 range)
  - Test speed clamp values (0.25-3 range)
- Integration:
  - Test volume control through Player component UI
  - Test speed control through Player component UI
  - Test volume/speed changes persist across pause/resume cycles
  - Test volume/speed changes persist across track changes

acceptance_criteria:
- Volume slider in Player component changes volume in real-time
- Speed controls in Player component change playback speed in real-time
- Volume changes are visible in system audio output
- Speed changes are immediately reflected in playback rate
- No errors logged when changing volume or speed
- Volume/speed settings persist when restarting the app

validation:
- Run `bun test src/utils/audio-player.test.ts` to verify unit tests pass
- Test volume control using Up/Down arrow keys in Player
- Test speed control using 'S' key in Player
- Verify volume level is visible in PlaybackControls component
- Verify speed level is visible in PlaybackControls component
- Check console logs for any IPC errors

notes:
- mpv backend uses JSON IPC over Unix socket - need to validate response format
- afplay backend needs to restart process for volume/speed changes (current behavior)
- ffplay backend doesn't support runtime volume/speed changes (document limitation)
- Volume and speed state is stored in backend class properties and should be updated on successful commands
- Reference: src/utils/audio-player.ts lines 206-223 (mpv send method), lines 789-791 (afplay setVolume), lines 793-795 (afplay setSpeed)
