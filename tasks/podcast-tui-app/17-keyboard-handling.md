# 16. Implement Tab Navigation Component

meta:
  id: podcast-tui-app-16
  feature: podcast-tui-app
  priority: P0
  depends_on: [15]
  tags: [navigation, tabs, solidjs, opentui]

objective:
- Create reusable tab navigation component
- Implement tab selection state
- Add keyboard navigation for tabs
- Handle active tab highlighting

deliverables:
- `src/components/TabNavigation.tsx` with tab navigation
- `src/components/Tab.tsx` with individual tab component
- `src/hooks/useTabNavigation.ts` with tab logic

steps:
- Create `src/components/TabNavigation.tsx`:
  - Accept tabs array as prop
  - Render tab buttons
  - Manage selected tab state
  - Update parent component on tab change
- Create `src/components/Tab.tsx`:
  - Individual tab button
  - Highlight selected tab
  - Handle click and keyboard events
  - Show tab icon if needed
- Create `src/hooks/useTabNavigation.ts`:
  - Manage tab selection state
  - Handle keyboard navigation (arrow keys)
  - Update parent component
  - Persist selected tab

tests:
- Unit: Test Tab component renders correctly
- Unit: Test tab selection updates state
- Integration: Test keyboard navigation
- Integration: Test tab persists across renders

acceptance_criteria:
- TabNavigation displays all tabs correctly
- Tab selection is visually indicated
- Keyboard navigation works (arrow keys, enter)
- Active tab persists

validation:
- Run application and verify tabs appear
- Click tabs to test selection
- Use arrow keys to navigate
- Restart app and verify active tab persists

notes:
- Use SolidJS `createSignal` for tab state
- Follow OpenTUI component patterns
- Tabs: Discover, My Feeds, Search, Player, Settings
- Add keyboard shortcuts documentation
