# 13. Set Up TypeScript Configuration and Build System

meta:
  id: podcast-tui-app-13
  feature: podcast-tui-app
  priority: P0
  depends_on: [01]
  tags: [typescript, build-system, configuration, solidjs]

objective:
- Configure TypeScript for SolidJS and OpenTUI
- Set up build system for production
- Configure bundler for optimal output
- Add development and production scripts

deliverables:
- `tsconfig.json` with TypeScript configuration
- `bunfig.toml` with Bun configuration
- `package.json` with build scripts
- `.bunfig.toml` with build settings

steps:
- Configure TypeScript in `tsconfig.json`:
  - Set target to ES2020
  - Configure paths for SolidJS
  - Add OpenTUI type definitions
  - Enable strict mode
  - Configure module resolution
- Configure Bun in `bunfig.toml`:
  - Set up dependencies
  - Configure build output
  - Add optimization flags
- Update `package.json`:
  - Add build script: `bun run build`
  - Add dev script: `bun run dev`
  - Add test script: `bun run test`
  - Add lint script: `bun run lint`
- Configure bundler for production:
  - Optimize bundle size
  - Minify output
  - Tree-shake unused code

tests:
- Unit: Verify TypeScript configuration
- Integration: Test build process
- Integration: Test dev script

acceptance_criteria:
- TypeScript compiles without errors
- Build script creates optimized bundle
- Dev script runs development server
- All scripts work correctly

validation:
- Run `bun run build` to verify build
- Run `bun run dev` to verify dev server
- Check bundle size is reasonable

notes:
- Use `bun build` for production builds
- Enable source maps for debugging
- Configure TypeScript to match OpenTUI requirements
- Add path aliases for cleaner imports
