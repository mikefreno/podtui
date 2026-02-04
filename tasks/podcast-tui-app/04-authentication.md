# 04. Build Optional Authentication System

meta:
  id: podcast-tui-app-04
  feature: podcast-tui-app
  priority: P2
  depends_on: [03]
  tags: [authentication, optional, solidjs, security]

objective:
- Create authentication state management (disabled by default)
- Build simple login screen with email/password
- Implement 8-character code validation flow
- Add OAuth placeholder screens
- Create sync-only user profile

deliverables:
- `src/stores/auth.ts` with authentication state store
- `src/components/LoginScreen.tsx` with login form
- `src/components/CodeValidation.tsx` with 8-character code input
- `src/components/OAuthPlaceholder.tsx` with OAuth info
- `src/components/SyncProfile.tsx` with sync-only profile

steps:
- Create `src/stores/auth.ts` with Zustand store:
  - `user` state (initially null)
  - `isAuthenticated` state (initially false)
  - `login()` function
  - `logout()` function
  - `validateCode()` function
- Create `src/components/LoginScreen.tsx`:
  - Email input field
  - Password input field
  - Login button
  - Link to code validation flow
  - Link to OAuth placeholder
- Create `src/components/CodeValidation.tsx`:
  - 8-character code input
  - Validation logic (alphanumeric)
  - Submit button
  - Error message display
- Create `src/components/OAuthPlaceholder.tsx`:
  - Display OAuth information
  - Explain terminal limitations
  - Link to browser redirect flow
- Create `src/components/SyncProfile.tsx`:
  - User profile display
  - Sync status indicator
  - Profile management options
- Add auth screens to Navigation (hidden by default)

tests:
- Unit: Test authentication state management
- Unit: Test code validation logic
- Integration: Test login flow completes
- Integration: Test logout clears state

acceptance_criteria:
- Authentication is disabled by default (isAuthenticated = false)
- Login screen accepts email and password
- Code validation accepts 8-character codes
- OAuth placeholder displays limitations
- Sync profile shows user info
- Login state persists across sessions

validation:
- Run application and verify login screen is accessible
- Try to log in with valid credentials
- Try to log in with invalid credentials
- Test code validation with valid/invalid codes
- Verify authentication state persists

notes:
- Authentication is optional and disabled by default
- Focus on file sync, not user accounts
- Use simple validation (no real backend)
- Store authentication state in localStorage
- OAuth not feasible in terminal, document limitation
