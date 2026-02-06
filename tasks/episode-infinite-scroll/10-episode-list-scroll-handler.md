# 10. Add Scroll Event Listener to Episodes Panel

meta:
  id: episode-infinite-scroll-10
  feature: episode-infinite-scroll
  priority: P2
  depends_on: []
  tags: [ui, events, scroll]

objective:
- Detect when user scrolls to bottom of episodes list
- Add scroll event listener to episodes panel
- Track scroll position and trigger pagination when needed

deliverables:
- Scroll event handler function
- Scroll position tracking
- Integration with episodes panel

steps:
1. Modify MyShowsPage to add scroll event listener
2. Detect scroll-to-bottom event (when scrollHeight - scrollTop <= clientHeight)
3. Track current scroll position
4. Add debouncing for scroll events
5. Test scroll detection accuracy

tests:
- Unit: Test scroll detection logic
- Integration: Test scroll events in episodes panel
- Manual: Scroll to bottom and verify detection

acceptance_criteria:
- Scroll-to-bottom is detected accurately
- Debouncing prevents excessive event firing
- Scroll position is tracked correctly

validation:
- Scroll through episodes list
- Verify bottom detection works
- Test with different terminal sizes

notes:
- Use scrollbox component's scroll event if available
- Debounce scroll events to 100ms
- Handle both manual scroll and programmatic scroll
- Consider virtual scrolling if episode count is large
