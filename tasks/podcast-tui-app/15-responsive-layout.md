# 14. Create Project Directory Structure and Dependencies

meta:
  id: podcast-tui-app-14
  feature: podcast-tui-app
  priority: P0
  depends_on: [01]
  tags: [project-structure, organization, solidjs]

objective:
- Create organized project directory structure
- Set up all necessary folders and files
- Install and configure all dependencies
- Create placeholder files for future implementation

deliverables:
- `src/` directory with organized structure
- `src/components/` with component folders
- `src/stores/` with store files
- `src/types/` with type definitions
- `src/utils/` with utility functions
- `src/data/` with static data
- `tests/` with test structure
- `public/` for static assets
- `docs/` for documentation

steps:
- Create directory structure:
  - `src/components/` (all components)
  - `src/stores/` (state management)
  - `src/types/` (TypeScript types)
  - `src/utils/` (utility functions)
  - `src/data/` (static data)
  - `src/hooks/` (custom hooks)
  - `src/api/` (API clients)
  - `tests/` (test files)
  - `public/` (static assets)
  - `docs/` (documentation)
- Create placeholder files:
  - `src/index.tsx` (main entry)
  - `src/App.tsx` (app shell)
  - `src/main.ts` (Bun entry)
- Install dependencies:
  - Core: `@opentui/solid`, `@opentui/core`, `solid-js`
  - State: `zustand`
  - Testing: `@opentui/testing`
  - Utilities: `date-fns`, `uuid`
  - Optional: `react`, `@opentui/react` (for testing)

tests:
- Unit: Verify directory structure exists
- Integration: Verify all dependencies installed
- Component: Verify placeholder files exist

acceptance_criteria:
- All directories created
- All placeholder files exist
- All dependencies installed
- Project structure follows conventions

validation:
- Run `ls -R src/` to verify structure
- Run `bun pm ls` to verify dependencies
- Check all placeholder files exist

notes:
- Follow OpenTUI project structure conventions
- Keep structure organized and scalable
- Add comments to placeholder files
- Consider adding `eslint`, `prettier` for code quality
