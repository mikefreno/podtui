# AGENTS.md

## Build, Lint, and Test Commands

### Development
- `bun start` - Run the application
- `bun run dev` - Run with hot reload (watch mode)

### Build
- `bun run build` - Build JavaScript bundle to `dist/`
- `bun run build:native` - Build native libraries (requires `scripts/build-cavacore.sh`)

### Testing
- `bun test` - Run all tests
- `bun tests/cavacore-smoke.ts` - Run specific native library smoke test

### Linting
- `bun run lint` - Run the TypeScript typecheck (`bun tsc --noEmit`)

## Code Style Guidelines

### TypeScript Configuration
- Target: ESNext with bundler module resolution
- Strict mode enabled
- Path alias: `@/*` maps to `src/*`
- JSX: Use `@opentui/solid` as import source

### Import Organization
1. Third-party framework imports (solid-js, @opentui/solid)
2. Local utility imports
3. Type imports (separate from value imports)

### Naming Conventions
- **Components**: PascalCase (e.g., `FeedPage`, `Player`)
- **Hooks**: `use*` prefix (e.g., `useAudio`, `useAppKeyboard`)
- **Stores**: `create*` factory + `use*` accessor (e.g., `createFeedStore`, `useFeedStore`)
- **Utilities**: camelCase (e.g., `parseRSSFeed`, `detectPlayers`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_EPISODES_REFRESH`)
- **Types/interfaces**: PascalCase (e.g., `Feed`, `AudioBackend`)
- **Enums**: PascalCase (e.g., `FeedVisibility`)

### Code Structure
- **Section Dividers**: Use `// ── Section Name ────────────────────────────────────────────────────────────` format
- **Helper Functions**: Define before main logic
- **Factory Functions**: Use for store creation (return object with state, computed, actions)
- **Singleton Pattern**: Stores use module-level singleton with `use*` accessor

### Type Definitions
- Use `interface` for object shapes
- Use `type` for unions, intersections, and complex types
- Use `enum` for constant sets
- Export types from `src/types/` directory
- Include JSDoc comments for complex types

### Error Handling
- Use `try/catch` for async operations
- For expected failures, use `.catch(() => {})` to suppress errors
- Return default values on failure (e.g., `return []` or `return null`)
- Use `catch` blocks with descriptive comments for unexpected errors
- For UI components, wrap in `ErrorBoundary` with clear fallback

### Async Patterns
- Fire-and-forget async operations: `.catch(() => {})` with comment
- Async store initialization: IIFE `(async () => { ... })()`
- Promise handling: Use `.catch()` to return defaults

### Comments
- **File headers**: Brief description of file purpose
- **Complex functions**: JSDoc-style comments explaining behavior
- **Section dividers**: Visual separators for code organization
- **Inline comments**: Explain non-obvious logic, especially async patterns

### Code Formatting
- 2-space indentation
- No semicolons (Bun style)
- Arrow functions with implicit return where appropriate
- Object shorthand where possible
- Prefer `const` over `let`

### Reactivity (Solid.js)
- Use `createSignal` for primitive state
- Use `createMemo` for computed values
- Use `createEffect` for side effects
- Component functions return JSX
- Store functions return plain objects with state, computed, and actions

### Persistence
- Async persistence operations fire-and-forget
- Use `.catch(() => {})` to suppress errors
- Update state synchronously, persist asynchronously
- Use `setFeeds()` pattern to update state and trigger save

### Testing
- Test files in `tests/` directory
- Use Bun's test framework
- Include JSDoc comments explaining test purpose
- Native library tests use `bun:ffi` for FFI calls
