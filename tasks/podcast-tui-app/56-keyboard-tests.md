# 55. Write Component Tests

meta:
  id: podcast-tui-app-55
  feature: podcast-tui-app
  priority: P1
  depends_on: [54]
  tags: [testing, components, snapshot, solidjs]

objective:
- Write component tests for all major components
- Test component rendering
- Test component behavior
- Test component interactions

deliverables:
- `tests/components/Navigation.test.tsx`
- `tests/components/FeedList.test.tsx`
- `tests/components/SearchBar.test.tsx`
- `tests/components/Player.test.tsx`
- `tests/components/SettingsScreen.test.tsx`
- Test coverage for all components

steps:
- Write component tests:
  - `tests/components/Navigation.test.tsx`:
    - Test Navigation renders with correct tabs
    - Test tab selection updates state
    - Test keyboard navigation
  - `tests/components/FeedList.test.tsx`:
    - Test FeedList renders with feeds
    - Test FeedItem displays correctly
    - Test public/private filtering
    - Test keyboard navigation
  - `tests/components/SearchBar.test.tsx`:
    - Test search bar accepts input
    - Test search button triggers search
    - Test clear button clears input
  - `tests/components/Player.test.tsx`:
    - Test Player UI displays correctly
    - Test playback controls work
    - Test waveform visualization
  - `tests/components/SettingsScreen.test.tsx`:
    - Test SettingsScreen renders correctly
    - Test settings navigation
    - Test settings save/load

tests:
- Unit: Run all component tests
- Coverage: Verify component coverage

acceptance_criteria:
- All component tests pass
- Test coverage > 80%
- Component behavior verified

validation:
- Run `bun test:components` to execute component tests
- Run `bun test --coverage` for coverage report
- Fix any failing tests

notes:
- Use OpenTUI testing framework
- Test components in isolation
- Mock external dependencies
- Use test fixtures for data
- Keep tests fast
- Test both happy path and error cases
