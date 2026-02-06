# 04. Add media key listeners to audio hook

meta:
  id: audio-playback-fix-04
  feature: audio-playback-fix
  priority: P2
  depends_on: []
  tags: [implementation, integration, event-handling]

objective:
- Integrate multimedia key handling with existing audio hook
- Route multimedia key events to appropriate audio control actions
- Ensure proper cleanup of event listeners

deliverables:
- Updated `useAudio()` hook with multimedia key event handling
- Media key event listener registration in audio hook
- Integration with multimedia key detection hook
- Proper cleanup of event listeners on component unmount

steps:
- Step 1: Import multimedia key detection hook into audio hook
- Step 2: Register multimedia key event listener in audio hook
- Step 3: Map multimedia key events to audio control actions (play/pause, seek, volume)
- Step 4: Add event listener cleanup on hook dispose
- Step 5: Test event listener cleanup with multiple component instances
- Step 6: Add error handling for failed multimedia key events
- Step 7: Test multimedia key events trigger correct audio actions

tests:
- Unit:
  - Test multimedia key events are captured in audio hook
  - Test events are mapped to correct audio control actions
  - Test event listeners are properly cleaned up
  - Test multiple audio hook instances don't conflict
- Integration:
  - Test multimedia keys control playback from any component
  - Test multimedia keys work when player is not focused
  - Test multimedia keys don't interfere with other keyboard shortcuts
  - Test event listeners are removed when audio hook is disposed

acceptance_criteria:
- Multimedia key events are captured by audio hook
- Multimedia keys trigger correct audio control actions
- Event listeners are properly cleaned up on unmount
- No duplicate event listeners when components re-render
- No memory leaks from event listeners
- Error handling prevents crashes from invalid events

validation:
- Use multimedia keys and verify audio responds correctly
- Unmount and remount audio hook to test cleanup
- Check for memory leaks with browser dev tools or system monitoring
- Verify event listener count is correct after cleanup
- Test with multiple Player components to ensure no conflicts

notes:
- Audio hook is a singleton, so event listeners should be registered once
- Multimedia key detection hook should be reused to avoid duplicate listeners
- Event listener cleanup should use onCleanup from solid-js
- Reference: src/hooks/useAudio.ts for event listener patterns
- Multimedia keys may only work when terminal is focused (platform limitation)
- Consider adding platform-specific key codes for better compatibility
