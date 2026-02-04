# 02. Create Main App Shell with Tab Navigation

meta:
  id: podcast-tui-app-02
  feature: podcast-tui-app
  priority: P0
  depends_on: [01]
  tags: [layout, navigation, solidjs, opentui]

objective:
- Create the main application shell with a responsive layout
- Implement tab-based navigation system
- Set up the root component structure
- Configure Flexbox layout for terminal UI

deliverables:
- `src/App.tsx` with main app shell
- `src/components/Navigation.tsx` with tab navigation
- `src/components/Layout.tsx` with responsive layout
- Tab navigation component with 5 tabs: Discover, My Feeds, Search, Player, Settings

steps:
- Create `src/App.tsx` with main component that renders Navigation
- Create `src/components/Navigation.tsx` with tab navigation
  - Use `<box>` with `<scrollbox>` for navigation
  - Implement tab selection state with `createSignal`
  - Add keyboard navigation (arrow keys)
  - Add tab labels: "Discover", "My Feeds", "Search", "Player", "Settings"
- Create `src/components/Layout.tsx` with responsive layout
  - Use Flexbox with `flexDirection="column"`
  - Create top navigation bar
  - Create main content area
  - Handle terminal resizing
- Update `src/index.tsx` to render the app

tests:
- Unit: Test Navigation component renders with correct tabs
- Integration: Test keyboard navigation moves between tabs
- Component: Verify layout adapts to terminal size changes

acceptance_criteria:
- Navigation component displays 5 tabs correctly
- Tab selection is visually indicated
- Arrow keys navigate between tabs
- Layout fits within terminal bounds

validation:
- Run application and verify navigation appears
- Press arrow keys to test navigation
- Resize terminal and verify layout adapts

notes:
- Use SolidJS `createSignal` for state management
- Follow OpenTUI layout patterns from `layout/REFERENCE.md`
- Navigation should be persistent across all screens
