# 01. Initialize SolidJS OpenTUI Project with Bun

meta:
  id: podcast-tui-app-01
  feature: podcast-tui-app
  priority: P0
  depends_on: []
  tags: [project-setup, solidjs, opentui, bun]

objective:
- Initialize a new SolidJS-based OpenTUI project using Bun
- Set up project structure with all necessary dependencies
- Configure TypeScript and development environment

deliverables:
- `/podcast-tui-app/` directory created
- `package.json` with all dependencies
- `tsconfig.json` configured for TypeScript
- `bunfig.toml` with Bun configuration
- `.gitignore` for Git version control
- `README.md` with project description

steps:
- Run `bunx create-tui@latest -t solid podcast-tui-app` to initialize the project
- Verify project structure is created correctly
- Install additional dependencies: `bun add @opentui/solid @opentui/core solid-js zustand`
- Install dev dependencies: `bun add -d @opentui/testing @opentui/react @opentui/solid`
- Configure TypeScript in `tsconfig.json` with SolidJS and OpenTUI settings
- Create `.gitignore` with Node and Bun specific files
- Initialize Git repository: `git init`

tests:
- Unit: Verify `create-tui` command works without errors
- Integration: Test that application can be started with `bun run src/index.tsx`
- Environment: Confirm all dependencies are installed correctly

acceptance_criteria:
- Project directory `podcast-tui-app/` exists
- `package.json` contains `@opentui/solid` and `@opentui/core` dependencies
- `bun run src/index.tsx` starts the application without errors
- TypeScript compilation works with `bun run build`

validation:
- Run `bun run build` to verify TypeScript compilation
- Run `bun run src/index.tsx` to start the application
- Run `bun pm ls` to verify all dependencies are installed

notes:
- OpenTUI is already installed in the system
- Use `-t solid` flag for SolidJS template
- All commands should be run from the project root
