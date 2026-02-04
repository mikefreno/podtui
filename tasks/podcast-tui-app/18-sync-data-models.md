# 17. Add Keyboard Shortcuts and Navigation Handling

meta:
  id: podcast-tui-app-17
  feature: podcast-tui-app
  priority: P1
  depends_on: [16]
  tags: [keyboard, shortcuts, navigation, solidjs, opentui]

objective:
- Implement global keyboard shortcuts
- Add shortcut documentation
- Handle keyboard events across components
- Prevent conflicts with input fields

deliverables:
- `src/components/KeyboardHandler.tsx` with global shortcuts
- `src/components/ShortcutHelp.tsx` with shortcut list
- `src/hooks/useKeyboard.ts` with keyboard utilities
- `src/config/shortcuts.ts` with shortcut definitions

steps:
- Create `src/config/shortcuts.ts`:
  - Define all keyboard shortcuts
  - Map keys to actions
  - Document each shortcut
- Create `src/hooks/useKeyboard.ts`:
  - Global keyboard event listener
  - Filter events based on focused element
  - Handle modifier keys (Ctrl, Shift, Alt)
  - Prevent default browser behavior
- Create `src/components/KeyboardHandler.tsx`:
  - Wrap application with keyboard handler
  - Handle escape to close modals
  - Handle Ctrl+Q to quit
  - Handle Ctrl+S to save
- Create `src/components/ShortcutHelp.tsx`:
  - Display all shortcuts
  - Organize by category
  - Click to copy shortcut

tests:
- Unit: Test keyboard hook handles events
- Unit: Test modifier key combinations
- Integration: Test shortcuts work globally
- Integration: Test shortcuts don't interfere with inputs

acceptance_criteria:
- All shortcuts work as defined
- Shortcuts help displays correctly
- Shortcuts don't interfere with input fields
- Escape closes modals

validation:
- Run application and test each shortcut
- Try shortcuts in input fields (shouldn't trigger)
- Check ShortcutHelp displays all shortcuts
- Test Ctrl+Q quits app

notes:
- Use OpenTUI keyboard patterns from `keyboard/REFERENCE.md`
- Common shortcuts:
  - Ctrl+Q: Quit
  - Ctrl+S: Save
  - Escape: Close modal/exit input
  - Arrow keys: Navigate
  - Space: Play/Pause
- Document shortcuts in README
- Test on different terminals
