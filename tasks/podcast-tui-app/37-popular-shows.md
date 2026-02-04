# 36. Build Search History with Persistent Storage

meta:
  id: podcast-tui-app-36
  feature: podcast-tui-app
  priority: P1
  depends_on: [35]
  tags: [search-history, persistence, storage, solidjs]

objective:
- Implement search history functionality
- Store search queries in localStorage
- Display recent searches
- Add search to history
- Clear history

deliverables:
- `src/components/SearchHistory.tsx` with history list
- `src/utils/history.ts` with history management
- `src/hooks/useSearchHistory.ts` with history hook

steps:
- Create `src/utils/history.ts`:
  - `addToHistory(query: string): void`
  - `getHistory(): string[]`
  - `removeFromHistory(query: string): void`
  - `clearHistory(): void`
  - `maxHistorySize = 50`
- Create `src/hooks/useSearchHistory.ts`:
  - `createSignal` for history array
  - Update history on search
  - Persist to localStorage
  - Methods to manage history
- Create `src/components/SearchHistory.tsx`:
  - Display recent search queries
  - Click to re-run search
  - Delete individual history items
  - Clear all history button
  - Persistent across sessions

tests:
- Unit: Test history management functions
- Unit: Test history persistence
- Integration: Test history display

acceptance_criteria:
- Search queries added to history
- History persists across sessions
- History displays correctly
- Clear history works

validation:
- Run application and perform searches
- Check search history persists
- Test clearing history
- Restart app and verify

notes:
- Use localStorage for persistence
- Limit history to 50 items
- Remove duplicates
- Store timestamps (optional)
- Clear history button in search screen
- Add delete button on individual items
