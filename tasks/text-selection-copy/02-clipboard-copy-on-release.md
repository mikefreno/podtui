# 02. Implement Clipboard Copy on Selection Release

meta:
  id: text-selection-copy-02
  feature: text-selection-copy
  priority: P2
  depends_on: [text-selection-copy-01]
  tags: [clipboard, events, user-experience]

objective:
- Copy selected text to clipboard when selection is released
- Handle terminal clipboard limitations
- Provide user feedback when copy succeeds

deliverables:
- Clipboard copy logic triggered on selection release
- User notifications for copy actions
- Integration with existing clipboard utilities

steps:
1. Add event listener for selection release events
2. Extract selected text from current focus component
3. Use existing Clipboard.copy() utility
4. Emit "clipboard.copied" event for notifications
5. Add visual feedback (toast notification)

tests:
- Unit: Test clipboard copy function with various text inputs
- Integration: Verify copy happens on selection release
- Manual: Select text and verify it appears in clipboard

acceptance_criteria:
- Selected text is copied to clipboard when selection ends
- User receives feedback when copy succeeds
- Works across different terminal environments

validation:
- Select text in Player description
- Verify text is in clipboard after selection ends
- Check for toast notification

notes:
- Use existing Clipboard namespace from `src/utils/clipboard.ts`
- Consider timing of selection release vs terminal refresh
- May need to debounce copy operations
