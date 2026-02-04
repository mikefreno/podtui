# 26. Add OAuth Placeholder Screens (Document Limitations)

meta:
  id: podcast-tui-app-26
  feature: podcast-tui-app
  priority: P2
  depends_on: [25]
  tags: [oauth, documentation, placeholders, solidjs]

objective:
- Create OAuth placeholder screens
- Document terminal limitations for OAuth
- Provide alternative authentication methods
- Explain browser redirect flow

deliverables:
- `src/components/OAuthPlaceholder.tsx` with OAuth info
- `src/components/BrowserRedirect.tsx` with redirect flow
- `src/docs/oauth-limitations.md` with documentation

steps:
- Create `src/components/OAuthPlaceholder.tsx`:
  - Display OAuth information
  - Explain terminal limitations
  - Show supported providers (Google, Apple)
  - Link to browser redirect flow
- Create `src/components/BrowserRedirect.tsx`:
  - Display QR code for mobile
  - Display 8-character code
  - Instructions for browser flow
  - Link to website
- Create `src/docs/oauth-limitations.md`:
  - Detailed explanation of OAuth in terminal
  - Why OAuth is not feasible
  - Alternative authentication methods
  - Browser redirect flow instructions
- Add OAuth placeholder to login screen

tests:
- Unit: Test OAuth placeholder displays correctly
- Unit: Test browser redirect flow displays
- Documentation review

acceptance_criteria:
- OAuth placeholder screens display correctly
- Limitations are clearly documented
- Alternative methods are provided
- Browser redirect flow is explained

validation:
- Run application and navigate to OAuth placeholder
- Read documentation
- Verify flow instructions are clear

notes:
- OAuth in terminal is not feasible
- Terminal cannot handle OAuth flows
- Document this limitation clearly
- Provide browser redirect as alternative
- User can still use file sync
- Google and Apple OAuth are supported by browser
