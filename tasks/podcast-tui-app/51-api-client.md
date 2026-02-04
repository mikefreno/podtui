# 50. Create Global State Store (Signals)

meta:
  id: podcast-tui-app-50
  feature: podcast-tui-app
  priority: P0
  depends_on: [49]
  tags: [state-management, global-store, signals, solidjs]

objective:
- Create global state store using SolidJS Signals
- Manage application-wide state
- Provide state to all components
- Handle state updates and persistence

deliverables:
- `src/stores/appStore.ts` with global state store
- `src/stores/feedStore.ts` with feed state
- `src/stores/playerStore.ts` with player state
- `src/stores/searchStore.ts` with search state

steps:
- Create `src/stores/appStore.ts`:
  - Use SolidJS signals for global state
  - Store application state: currentTab, isAuthEnabled, settings
  - Provide state to all child components
  - Update state when needed
- Create `src/stores/feedStore.ts`:
  - Signals for feeds array
  - Signals for selectedFeed
  - Methods: addFeed, removeFeed, updateFeed
- Create `src/stores/playerStore.ts`:
  - Signals for currentEpisode
  - Signals for playbackState
  - Methods: play, pause, seek, setSpeed
- Create `src/stores/searchStore.ts`:
  - Signals for searchResults
  - Signals for searchHistory
  - Methods: search, addToHistory, clearHistory

tests:
- Unit: Test store methods update signals correctly
- Unit: Test state persistence
- Integration: Test state updates across components

acceptance_criteria:
- Global state store manages all app state
- Store methods update signals correctly
- State persists across component re-renders
- State updates propagate to UI

validation:
- Run application and verify state is initialized
- Modify state and verify UI updates
- Restart app and verify state persistence

notes:
- Use SolidJS `createSignal` for reactivity
- Store should be singleton pattern
- Use `createStore` if complex state needed
- Keep store simple and focused
- Store state in localStorage
