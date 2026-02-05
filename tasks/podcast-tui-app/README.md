# Podcast TUI App

Objective: Build a SolidJS-based podcast player TUI with feeds, search, player, and file sync

Status legend: [ ] todo, [~] in-progress, [x] done

---

## Phase 1: Project Foundation 🏗️
**Setup and configure the development environment**

- [x] 01 — Initialize SolidJS OpenTUI project with Bun → `01-project-setup.md`
- [x] 13 — Set up TypeScript configuration and build system → `13-typescript-config.md`
- [x] 14 — Create project directory structure and dependencies → `14-project-structure.md`
- [x] 15 — Build responsive layout system (Flexbox) → `15-responsive-layout.md`

**Dependencies:** 01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 11 -> 12

---

## Phase 2: Core Architecture 🏗️
**Build the main application shell and navigation**

- [x] 02 — Create main app shell with tab navigation → `02-core-layout.md`
- [x] 16 — Implement tab navigation component → `16-tab-navigation.md`
- [x] 17 — Add keyboard shortcuts and navigation handling → `17-keyboard-handling.md`

**Dependencies:** 01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 11 -> 12

---

## Phase 3: File Sync & Data Import/Export 💾
**Implement direct file sync with JSON/XML formats**

- [x] 03 — Implement direct file sync (JSON/XML import/export) → `03-file-sync.md`
- [x] 18 — Create sync data models (JSON/XML formats) → `18-sync-data-models.md`
- [x] 19 — Build import/export functionality → `19-import-export.md`
- [x] 20 — Create file picker UI for import → `20-file-picker.md`
- [x] 21 — Build sync status indicator → `21-sync-status.md`
- [x] 22 — Add backup/restore functionality → `22-backup-restore.md`

**Dependencies:** 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 11 -> 12

---

## Phase 4: Authentication System 🔐
**Implement authentication (MUST be implemented as optional for users)**

- [x] 04 — Build optional authentication system → `04-authentication.md`
- [x] 23 — Create authentication state (disabled by default) → `23-auth-state.md`
- [x] 24 — Build simple login screen (email/password) → `24-login-screen.md`
- [x] 25 — Implement 8-character code validation flow → `25-code-validation.md`
- [x] 26 — Add OAuth placeholder screens (document limitations) → `26-oauth-placeholders.md`
- [x] 27 — Create sync-only user profile → `27-sync-profile.md`

**Dependencies:** 03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 11 -> 12

---

## Phase 5: Feed Management 📻
**Create feed data models and management UI**

- [x] 05 — Create feed data models and types → `05-feed-management.md`
- [x] 28 — Create feed data models and types → `28-feed-types.md`
- [x] 29 — Build feed list component (public/private feeds) → `29-feed-list.md`
- [x] 30 — Implement feed source management (add/remove sources) → `30-source-management.md`
- [x] 31 — Add reverse chronological ordering → `31-reverse-chronological.md`
- [x] 32 — Create feed detail view → `32-feed-detail.md`

**Dependencies:** 01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 11 -> 12

---

## Phase 6: Search Functionality 🔍
**Implement multi-source search interface**

- [x] 06 — Implement multi-source search interface → `06-search.md`
- [x] 33 — Create search interface → `33-search-interface.md`
- [x] 34 — Implement multi-source search → `34-multi-source-search.md`
- [x] 35 — Add search results display → `35-search-results.md`
- [x] 36 — Build search history with persistent storage → `36-search-history.md`

**Dependencies:** 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 11 -> 12

---

## Phase 7: Discover Feed 🌟
**Build discover page with popular shows**

- [x] 07 — Build discover feed with popular shows → `07-discover.md`
- [x] 37 — Create popular shows data structure → `37-popular-shows.md`
- [x] 38 — Build discover page component → `38-discover-page.md`
- [x] 39 — Add trending shows display → `39-trending-shows.md`
- [x] 40 — Implement category filtering → `40-category-filtering.md`

**Dependencies:** 06 -> 07 -> 08 -> 09 -> 10 -> 11 -> 12

---

## Phase 8: Player Component 🎵
**Create player UI with waveform visualization**

- [x] 08 — Create player UI with waveform visualization → `08-player.md`
- [x] 41 — Create player UI layout → `41-player-layout.md`
- [x] 42 — Implement playback controls → `42-playback-controls.md`
- [x] 43 — Build ASCII waveform visualization → `43-waveform-visualization.md`
- [x] 44 — Add progress tracking and seek → `44-progress-tracking.md`
- [x] 45 — Implement audio integration (system/external player) → `45-audio-integration.md`

**Dependencies:** 07 -> 08 -> 09 -> 10 -> 11 -> 12

---

## Phase 9: Settings & Configuration ⚙️
**Build settings screen and preferences**

- [x] 09 — Build settings screen and preferences → `09-settings.md`
- [x] 46 — Create settings screen → `46-settings-screen.md`
- [x] 47 — Add source management UI → `47-source-management-ui.md`
- [x] 48 — Build user preferences → `48-user-preferences.md`
- [x] 49 — Implement data persistence (localStorage/file-based) → `49-data-persistence.md`

**Dependencies:** 08 -> 09 -> 10 -> 11 -> 12

---

## Phase 10: Theme System 🎨
**Implement theming with Catppuccin, Gruvbox, Tokyo, Nord, and custom themes**

- [x] 59 — Create theme system architecture → `59-theme-system.md`
- [x] 60 — Implement default theme (system terminal) → `60-default-theme.md`
- [x] 61 — Add Catppuccin theme → `61-catppuccin-theme.md`
- [x] 62 — Add Gruvbox theme → `62-gruvbox-theme.md`
- [x] 63 — Add Tokyo theme → `63-tokyo-theme.md`
- [x] 64 — Add Nord theme → `64-nord-theme.md`
- [ ] 65 — Implement custom theme editor → `65-custom-theme.md`
- [x] 66 — Add theme selector in settings → `66-theme-selector.md`

**Dependencies:** 09 -> 59 -> 60 -> 61 -> 62 -> 63 -> 64 -> 65 -> 66 -> 10

---

## Phase 11: State Management & Data Layer 🗄️
**Create global state store and data layer**

- [x] 10 — Create global state store and data layer → `10-state-management.md`
- [x] 50 — Create global state store (Signals) → `50-global-state-store.md`
- [x] 51 — Implement API client for podcast sources → `51-api-client.md`
- [x] 52 — Add data fetching and caching → `52-data-fetching-caching.md`
- [x] 53 — Build file-based storage for sync → `53-file-based-storage.md`

**Dependencies:** 66 -> 10

---

## Phase 12: Testing & Quality Assurance ✅
**Set up testing framework and write comprehensive tests**

- [ ] 11 — Set up testing framework and write tests → `11-testing.md`
- [ ] 54 — Set up testing framework (snapshot testing) → `54-testing-framework.md`
- [ ] 55 — Write component tests → `55-component-tests.md`
- [ ] 56 — Add keyboard interaction tests → `56-keyboard-tests.md`
- [x] 57 — Implement error handling → `57-error-handling.md`
- [x] 58 — Add loading states and transitions → `58-loading-states.md`

**Dependencies:** 10 -> 11

---

## Phase 13: OAuth & External Integration 🔗
**Complete OAuth implementation and external integrations**

- [x] 26 — Add OAuth placeholder screens (document limitations) → `26-oauth-placeholders.md`
- [ ] 67 — Implement browser redirect flow for OAuth → `67-browser-redirect.md`
- [ ] 68 — Build QR code display for mobile verification → `68-qr-code-display.md`

**Dependencies:** 04 -> 67 -> 68

---

## Phase 14: Deployment & Optimization 🚀
**Optimize bundle and create documentation**

- [ ] 12 — Optimize bundle and create documentation → `12-optimization.md`

**Dependencies:** 11

---

## Dependencies Summary
- **Phase dependencies** ensure logical implementation order
- **Authentication MUST be implemented** (just optional for user login)
- **Theme system** is required and comes before state management

---

## Exit criteria
- The feature is complete when all 58 tasks are marked [x] done
- Complete, functional podcast TUI application with all core features working
- File sync (JSON/XML) successfully imports/exports feeds and settings
- Authentication system is fully implemented (optional for users)
- Player has waveform visualization and playback controls
- All navigation and keyboard shortcuts work correctly
- Theme system works with Catppuccin, Gruvbox, Tokyo, Nord, and custom themes
- Application runs on Bun with OpenTUI
