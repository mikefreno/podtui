# 01. Create JSON Theme Schema and File Structure

meta:
  id: theme-refactoring-01
  feature: theme-refactoring-json-format
  priority: P0
  depends_on: []
  tags: [implementation, infrastructure]

objective:
- Create the JSON theme schema and establish the file structure for theme definitions
- Define the theme.json schema that opencode uses
- Create the directory structure for JSON theme files

deliverables:
- `src/types/theme-schema.ts` - JSON theme schema definition
- `src/themes/*.json` - Directory for theme JSON files
- `src/themes/schema.json` - Theme schema reference

steps:
- Step 1.1: Create `src/types/theme-schema.ts` with TypeScript interfaces matching the opencode theme JSON structure
  - Define `ThemeJson` interface with `$schema`, `defs`, and `theme` properties
  - Define `ColorValue` type supporting hex colors, color references, variants, and RGBA
  - Define `Variant` type for light/dark mode color definitions
  - Export interfaces for type checking

- Step 1.2: Create `src/themes/schema.json` with the opencode theme schema reference
  - Add `$schema: "https://opencode.ai/theme.json"`
  - Document the theme structure in comments

- Step 1.3: Create `src/themes/` directory
  - Ensure directory exists for JSON theme files

- Step 1.4: Create a sample theme file in `src/themes/opencode.json`
  - Use the opencode theme as reference
  - Include proper `$schema` reference
  - Define `defs` with all color references
  - Define `theme` with semantic color mappings

tests:
- Unit:
  - Test `ThemeJson` type definition matches opencode structure
  - Test `ColorValue` type accepts hex colors, references, variants, and RGBA
  - Test `Variant` type structure is correct

- Integration/e2e:
  - Verify JSON file can be parsed without errors
  - Validate schema reference is correct

acceptance_criteria:
- `src/types/theme-schema.ts` file exists with all required interfaces
- `src/themes/schema.json` contains valid schema reference
- `src/themes/` directory is created
- `src/themes/opencode.json` can be imported and parsed successfully

validation:
- Run: `bun run typecheck` - Should pass with no type errors
- Run: `cat src/themes/opencode.json | jq .` - Should be valid JSON

notes:
- Follow opencode's theme.json structure exactly
- Use TypeScript interfaces to ensure type safety
- Reference: `/home/mike/code/PodTui/opencode/packages/opencode/src/cli/cmd/tui/context/theme/`
