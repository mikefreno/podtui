# 67. Implement Browser Redirect Flow for OAuth

meta:
  id: podcast-tui-app-67
  feature: podcast-tui-app
  priority: P2
  depends_on: [04]
  tags: [oauth, authentication, browser, solidjs]

objective:
- Implement browser redirect flow for OAuth authentication
- Handle OAuth callback in terminal application
- Exchange authorization code for access token
- Store authentication tokens securely

deliverables:
- `/src/auth/oauth-redirect.ts` - OAuth redirect handler
- `/src/auth/oauth-callback.ts` - OAuth callback handler
- `/src/auth/token-handler.ts` - Token exchange and storage
- Updated `/src/auth/login-screen.tsx` with OAuth option
- Updated `/src/auth/authentication-state.ts` for OAuth state

steps:
- Implement OAuth authorization URL generation with client ID/secret
- Create OAuth redirect handler to capture callback
- Handle authorization code exchange with token endpoint
- Store access token and refresh token securely
- Implement error handling for OAuth failures
- Add OAuth state parameter for security
- Update authentication state to track OAuth login status
- Add OAuth logout functionality

tests:
- Unit: Test OAuth authorization URL generation
- Unit: Test token exchange with valid/invalid code
- Unit: Test token storage and retrieval
- Integration: Test OAuth flow from start to finish

acceptance_criteria:
- OAuth authorization URL is generated correctly
- OAuth callback is handled without errors
- Access token is stored securely
- OAuth flow works with valid credentials
- OAuth errors are handled gracefully

validation:
- Run `bun run build` to verify TypeScript compilation
- Test OAuth flow manually with test credentials
- Verify token storage in localStorage
- Check error handling for invalid tokens

notes:
- Use standard OAuth 2.0 flow (authorization code grant)
- Document OAuth requirements (client ID, redirect URI)
- Consider using PKCE for enhanced security
- Test with real OAuth provider if possible
- Document limitations and requirements
