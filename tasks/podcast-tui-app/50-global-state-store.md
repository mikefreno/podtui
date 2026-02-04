# 50. Create Global State Store (Signals)

meta:
  id: podcast-tui-app-50
  feature: podcast-tui-app
  priority: P1
  depends_on: [66]
  tags: [state-management, signals, solidjs, global-store]

objective:
- Create a global state store using SolidJS Signals for reactive state management
- Implement a store that manages application-wide state (feeds, settings, user, etc.)
- Provide reactive subscriptions for state changes
- Ensure thread-safe state updates

deliverables:
- `/src/store/index.ts` - Global state store with Signals
- `/src/store/types.ts` - State type definitions
- `/src/store/hooks.ts` - Custom hooks for state access
- Updated `src/index.tsx` to initialize the store

steps:
- Define state interface with all application state properties (feeds, settings, user, etc.)
- Create Signal-based store using `createSignal` from SolidJS
- Implement computed signals for derived state (filtered feeds, search results, etc.)
- Create state update functions that trigger reactivity
- Add subscription mechanism for reactive UI updates
- Export store and hooks for use across components

tests:
- Unit: Test that signals update correctly when state changes
- Unit: Test computed signals produce correct derived values
- Integration: Verify store updates trigger UI re-renders
- Integration: Test multiple components can subscribe to same state

acceptance_criteria:
- Store can be initialized with default state
- State changes trigger reactive updates in components
- Computed signals work correctly for derived state
- Multiple components can access and subscribe to store
- State updates are thread-safe

validation:
- Run `bun run build` to verify TypeScript compilation
- Run application and verify state changes are reactive
- Check console for any errors during state updates

notes:
- Use `createSignal`, `createComputed`, `createEffect` from SolidJS
- Store should follow single source of truth pattern
- Consider using `batch` for multiple state updates
- State should be serializable for persistence
