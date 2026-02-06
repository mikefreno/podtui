# 02. Add multimedia key detection and handling

meta:
  id: audio-playback-fix-02
  feature: audio-playback-fix
  priority: P2
  depends_on: []
  tags: [implementation, keyboard, multimedia]

objective:
- Implement detection and handling of multimedia keys (Play/Pause, Next/Previous, Volume Up/Down)
- Create reusable multimedia key handler hook
- Map multimedia keys to audio playback actions

deliverables:
- New `useMultimediaKeys()` hook in `src/hooks/useMultimediaKeys.ts`
- Integration with existing audio hook to handle multimedia key events
- Documentation of supported multimedia keys and their mappings

steps:
- Step 1: Research @opentui/solid keyboard event types for multimedia key detection
- Step 2: Create `useMultimediaKeys()` hook with event listener for multimedia keys
- Step 3: Define multimedia key mappings (Play/Pause, Next, Previous, Volume Up, Volume Down)
- Step 4: Integrate hook with audio hook to trigger playback actions
- Step 5: Add keyboard event filtering to prevent conflicts with other shortcuts
- Step 6: Test multimedia key detection across different platforms
- Step 7: Add help text to Player component showing multimedia key bindings

tests:
- Unit:
  - Test multimedia key events are detected correctly
  - Test key mapping functions return correct audio actions
  - Test hook cleanup removes event listeners
- Integration:
  - Test Play/Pause key toggles playback
  - Test Next/Previous keys skip tracks (placeholder for future)
  - Test Volume Up/Down keys adjust volume
  - Test keys don't trigger when input is focused
  - Test keys don't trigger when player is not focused

acceptance_criteria:
- Multimedia keys are detected and logged when pressed
- Play/Pause key toggles audio playback
- Volume Up/Down keys adjust volume level
- Keys work when Player component is focused
- Keys don't interfere with other keyboard shortcuts
- Help text displays multimedia key bindings

validation:
- Press multimedia keys while Player is focused and verify playback responds
- Check console logs for detected multimedia key events
- Verify Up/Down keys adjust volume display in Player component
- Verify Space key still works for play/pause
- Test in different terminal emulators (iTerm2, Terminal.app, etc.)

notes:
- Multimedia key detection may vary by platform and terminal emulator
- Common multimedia keys: Space (Play/Pause), ArrowUp (Volume Up), ArrowDown (Volume Down)
- Some terminals don't pass multimedia keys to application
- May need to use platform-specific APIs or terminal emulator-specific key codes
- Reference: @opentui/solid keyboard event types and existing useKeyboard hook patterns
