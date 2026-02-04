# 23. Create Authentication State (Disabled by Default)

meta:
  id: podcast-tui-app-23
  feature: podcast-tui-app
  priority: P2
  depends_on: [22]
  tags: [authentication, state, solidjs, security]

objective:
- Create authentication state management
- Ensure authentication is disabled by default
- Set up user state structure
- Implement auth state persistence

deliverables:
- `src/stores/auth.ts` with authentication store
- `src/types/auth.ts` with auth types
- `src/config/auth.ts` with auth configuration

steps:
- Create `src/types/auth.ts`:
  - `User` interface (id, email, name, createdAt)
  - `AuthState` interface (user, isAuthenticated, isLoading)
  - `AuthError` interface (code, message)
- Create `src/config/auth.ts`:
  - `DEFAULT_AUTH_ENABLED = false`
  - `AUTH_CONFIG` with settings
  - `OAUTH_PROVIDERS` with provider info
- Create `src/stores/auth.ts`:
  - `createAuthStore()` with Zustand
  - `user` signal (initially null)
  - `isAuthenticated` signal (initially false)
  - `login()` function (placeholder)
  - `logout()` function
  - `validateCode()` function
  - Persist state to localStorage
- Set up auth state in global store

tests:
- Unit: Test auth state initializes correctly
- Unit: Test auth is disabled by default
- Unit: Test persistence

acceptance_criteria:
- Authentication is disabled by default
- Auth store manages state correctly
- State persists across sessions
- Auth is optional and not required

validation:
- Run application and verify auth is disabled
- Check localStorage for auth state
- Test login flow (should not work without backend)

notes:
- Authentication is secondary to file sync
- No real backend, just UI/UX
- Focus on sync features
- User can choose to enable auth later
- Store auth state in localStorage
