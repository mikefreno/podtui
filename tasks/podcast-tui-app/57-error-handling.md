# 56. Add Keyboard Interaction Tests

meta:
  id: podcast-tui-app-56
  feature: podcast-tui-app
  priority: P1
  depends_on: [55]
  tags: [testing, keyboard, interaction, solidjs]

objective:
- Write keyboard interaction tests
- Test keyboard shortcuts
- Test keyboard navigation
- Test input field keyboard handling

deliverables:
- `tests/integration/navigation.test.tsx`
- `tests/integration/keyboard.test.tsx`
- `tests/integration/inputs.test.tsx`

steps:
- Write keyboard tests:
  - `tests/integration/navigation.test.tsx`:
    - Test arrow keys navigate tabs
    - Test enter selects tab
    - Test escape closes modal
  - `tests/integration/keyboard.test.tsx`:
    - Test Ctrl+Q quits app
    - Test Ctrl+S saves settings
    - Test space plays/pauses
    - Test arrow keys for playback
  - `tests/integration/inputs.test.tsx`:
    - Test input field accepts text
    - Test keyboard input in search bar
    - Test code input validation

tests:
- Unit: Run keyboard tests
- Integration: Test keyboard interactions

acceptance_criteria:
- All keyboard tests pass
- Keyboard shortcuts work correctly
- Input fields handle keyboard input

validation:
- Run `bun test` to execute all tests
- Manually test keyboard shortcuts
- Verify keyboard navigation works

notes:
- Use OpenTUI testing framework
- Test keyboard events
- Mock keyboard input
- Test on different terminals
- Document keyboard shortcuts
- Test modifier key combinations
