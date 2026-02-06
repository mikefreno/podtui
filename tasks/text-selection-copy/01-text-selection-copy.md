# 01. Add Text Selection Event Handling

meta:
  id: text-selection-copy-01
  feature: text-selection-copy
  priority: P2
  depends_on: []
  tags: [ui, events, clipboard]

objective:
- Add event listeners for text selection events in the TUI components
- Detect when text is selected by the user
- Prepare infrastructure for clipboard copy on selection release

deliverables:
- New event bus events for text selection
- Selection state tracking in app store
- Event listener setup in main components

steps:
1. Create new event bus events for text selection (`selection.start`, `selection.end`)
2. Add selection state to app store (selectedText, selectionStart, selectionEnd)
3. Add event listeners to key components that display text
4. Track selection state changes in real-time
5. Add cleanup handlers for event listeners

tests:
- Unit: Test event bus event emission for selection events
- Integration: Verify selection state updates when text is selected
- Manual: Select text in different components and verify state tracking

acceptance_criteria:
- Selection events are emitted when text is selected
- Selection state is properly tracked in app store
- Event listeners are correctly registered and cleaned up

validation:
- Run the app and select text in Player component
- Check app store selection state is updated
- Verify event bus receives selection events

notes:
- Need to handle terminal-specific selection behavior
- Selection might not work in all terminal emulators
- Consider using OSC 52 for clipboard operations
