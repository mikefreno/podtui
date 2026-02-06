# 05. Test multimedia controls across platforms [x]

meta:
  id: audio-playback-fix-05
  feature: audio-playback-fix
  priority: P1
  depends_on: []
  tags: [testing, integration, cross-platform]

objective:
- Comprehensive testing of volume/speed controls and multimedia key support
- Verify platform-specific media integration works correctly
- Validate all controls across different audio backends

deliverables:
- Test suite for volume/speed controls in `src/utils/audio-player.test.ts`
- Integration tests for multimedia key handling in `src/hooks/useMultimediaKeys.test.ts`
- Platform-specific integration tests in `src/utils/media-registry.test.ts`
- Test coverage report showing all features tested

steps:
- Step 1: Run existing unit tests for audio player backends
- Step 2: Add volume control tests (setVolume, volume clamp, persistence)
- Step 3: Add speed control tests (setSpeed, speed clamp, persistence)
- Step 4: Create integration test for multimedia key handling
- Step 5: Test volume/speed controls with Player component UI
- Step 6: Test multimedia keys with Player component UI
- Step 7: Test platform-specific media integration on each platform
- Step 8: Test all controls across mpv, ffplay, and afplay backends
- Step 9: Document any platform-specific limitations or workarounds

tests:
- Unit:
  - Test volume control methods in all backends
  - Test speed control methods in all backends
  - Test volume clamp logic (0-1 range)
  - Test speed clamp logic (0.25-3 range)
  - Test multimedia key detection
  - Test event listener cleanup
- Integration:
  - Test volume control via Player component UI
  - Test speed control via Player component UI
  - Test multimedia keys via keyboard
  - Test volume/speed persistence across pause/resume
  - Test volume/speed persistence across track changes
- Cross-platform:
  - Test volume/speed controls on macOS
  - Test volume/speed controls on Linux
  - Test volume/speed controls on Windows
  - Test multimedia keys on each platform
  - Test media registration on each platform

acceptance_criteria:
- All unit tests pass with >90% code coverage
- All integration tests pass
- Volume controls work correctly on all platforms
- Speed controls work correctly on all platforms
- Multimedia keys work on all platforms
- Media controls appear on all supported platforms
- All audio backends (mpv, ffplay, afplay) work correctly
- No regressions in existing audio functionality

validation:
- Run full test suite: `bun test`
- Check test coverage: `bun test --coverage`
- Manually test volume controls on each platform
- Manually test speed controls on each platform
- Manually test multimedia keys on each platform
- Verify media controls appear on each platform
- Check for any console errors or warnings

notes:
- Test suite should cover all audio backend implementations
- Integration tests should verify UI controls work correctly
- Platform-specific tests should run on actual platform if possible
- Consider using test doubles for platform-specific APIs
- Document any platform-specific issues or limitations found
- Reference: Test patterns from existing test files in src/utils/

## Implementation Notes (Completed)

### Manual Validation Steps

1. **Volume controls (all backends)**
   - Launch app, load an episode, press Up/Down arrows on Player tab
   - Volume indicator in PlaybackControls should update (0.00 - 1.00)
   - Audio output volume should change audibly
   - Test on non-Player tabs: Up/Down should still adjust volume via global media keys

2. **Speed controls (mpv, afplay)**
   - Press `S` to cycle speed: 1.0 -> 1.25 -> 1.5 -> 1.75 -> 2.0 -> 0.5
   - Speed indicator should update in PlaybackControls
   - Audible pitch/speed change on mpv and afplay
   - ffplay: speed changes require track restart (documented limitation)

3. **Seek controls**
   - Press Left/Right arrows to seek -10s / +10s
   - Position indicator should update
   - Works on Player tab (local) and other tabs (global media keys)

4. **Global media keys (non-Player tabs)**
   - Navigate to Feed, Shows, or Discover tab
   - Start playing an episode from Player tab first
   - Switch to another tab
   - Press Space to toggle play/pause
   - Press Up/Down to adjust volume
   - Press Left/Right to seek
   - Press S to cycle speed

5. **Platform media integration (macOS)**
   - Install `nowplaying-cli`: `brew install nowplaying-cli`
   - Track info should appear in macOS Now Playing widget
   - If `nowplaying-cli` is not installed, graceful no-op (no errors)

### Platform Limitations

| Backend | Volume | Speed | Seek | Notes |
|---------|--------|-------|------|-------|
| **mpv** | Runtime (IPC) | Runtime (IPC) | Runtime (IPC) | Best support, uses Unix socket |
| **afplay** | Restart required | Restart required | Not supported | Process restarts with new args |
| **ffplay** | Restart required | Not supported | Not supported | No runtime speed flag |
| **system** | Depends on OS | Depends on OS | Depends on OS | Uses `open`/`xdg-open` |
| **noop** | No-op | No-op | No-op | Silent fallback |

### Media Registry Platform Support

| Platform | Integration | Status |
|----------|------------|--------|
| **macOS** | `nowplaying-cli` | Works if binary installed |
| **Linux** | MPRIS D-Bus | Stub (no-op), upgradable |
| **Windows** | None | No-op stub |

### Key Architecture Decisions
- Global media keys use event bus (`media.*` events) for decoupling
- `useMultimediaKeys` hook is called once in App.tsx
- Guards prevent double-handling when Player tab is focused (Player.tsx handles locally)
- Guards prevent interference when text input is focused
- MediaRegistry is a singleton, fire-and-forget, never throws
