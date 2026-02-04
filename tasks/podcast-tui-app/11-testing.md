# 11. Create Global State Store and Data Layer

meta:
  id: podcast-tui-app-11
  feature: podcast-tui-app
  priority: P0
  depends_on: [10]
  tags: [state-management, global-store, signals, solidjs]

objective:
- Create global state store using Signals
- Implement data fetching and caching
- Build file-based storage for sync
- Connect all components to shared state

deliverables:
- `src/stores/appStore.ts` with global state store
- `src/stores/feedStore.ts` with feed state
- `src/stores/playerStore.ts` with player state
- `src/stores/searchStore.ts` with search state
- `src/utils/storage.ts` with file-based storage

steps:
- Create `src/stores/appStore.ts`:
  - Use SolidJS signals for global state
  - Store application state: currentTab, isAuthEnabled, settings
  - Provide state to all child components
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
- Create `src/utils/storage.ts`:
  - `saveToLocal()`
  - `loadFromLocal()`
  - File-based sync for feeds and settings

tests:
- Unit: Test store methods update signals correctly
- Unit: Test storage functions
- Integration: Test state persists across components
- Integration: Test data sync with file storage

acceptance_criteria:
- Global state store manages all app state
- Store methods update signals correctly
- State persists across component re-renders
- File-based storage works for sync

validation:
- Run application and verify state is initialized
- Modify state and verify UI updates
- Restart app and verify state persistence
- Test sync functionality

notes:
- Use SolidJS `createSignal` for reactivity
- Store should be singleton pattern
- Use Zustand if complex state management needed
- Keep store simple and focused
- File-based storage for sync with JSON/XML
