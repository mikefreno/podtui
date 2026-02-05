# 02. Convert Existing Themes to JSON Format

meta:
  id: theme-refactoring-02
  feature: theme-refactoring-json-format
  priority: P0
  depends_on: [theme-refactoring-01]
  tags: [implementation, migration]

objective:
- Convert all existing PodTui themes (catppuccin, gruvbox, tokyo, nord) from TypeScript constants to JSON format
- Ensure each theme matches the opencode JSON structure
- Maintain color fidelity with original theme definitions

deliverables:
- `src/themes/catppuccin.json` - Catppuccin theme in JSON format
- `src/themes/gruvbox.json` - Gruvbox theme in JSON format
- `src/themes/tokyo.json` - Tokyo Night theme in JSON format
- `src/themes/nord.json` - Nord theme in JSON format

steps:
- Step 2.1: Convert `catppuccin` theme from `src/types/desktop-theme.ts` to JSON
  - Extract all color definitions from `THEMES_DESKTOP.variants.find((v) => v.name === "catppuccin")!.colors`
  - Create `defs` object with all color references (dark and light variants)
  - Create `theme` object with semantic mappings
  - Add `$schema` reference
  - Verify color values match original definitions

- Step 2.2: Convert `gruvbox` theme from `src/types/desktop-theme.ts` to JSON
  - Extract all color definitions from `THEMES_DESKTOP.variants.find((v) => v.name === "gruvbox")!.colors`
  - Create `defs` object with all color references
  - Create `theme` object with semantic mappings
  - Add `$schema` reference

- Step 2.3: Convert `tokyo` theme from `src/types/desktop-theme.ts` to JSON
  - Extract all color definitions from `THEMES_DESKTOP.variants.find((v) => v.name === "tokyo")!.colors`
  - Create `defs` object with all color references
  - Create `theme` object with semantic mappings
  - Add `$schema` reference

- Step 2.4: Convert `nord` theme from `src/types/desktop-theme.ts` to JSON
  - Extract all color definitions from `THEMES_DESKTOP.variants.find((v) => v.name === "nord")!.colors`
  - Create `defs` object with all color references
  - Create `theme` object with semantic mappings
  - Add `$schema` reference

- Step 2.5: Verify all JSON files are valid
  - Check syntax with `bun run typecheck`
  - Ensure all imports work correctly

tests:
- Unit:
  - Test each JSON file can be imported without errors
  - Verify color values match original TypeScript definitions

- Integration/e2e:
  - Load each theme and verify all colors are present
  - Check that theme structure matches expected schema

acceptance_criteria:
- All four theme JSON files exist in `src/themes/`
- Each JSON file follows the theme schema
- Color values match original theme definitions exactly
- All JSON files are valid and can be parsed

validation:
- Run: `bun run typecheck` - Should pass
- Run: `cat src/themes/catppuccin.json | jq .` - Should be valid JSON
- Run: `cat src/themes/gruvbox.json | jq .` - Should be valid JSON
- Run: `cat src/themes/tokyo.json | jq .` - Should be valid JSON
- Run: `cat src/themes/nord.json | jq .` - Should be valid JSON

notes:
- Use opencode's theme structure as reference
- Maintain backward compatibility with existing color definitions
- Ensure both dark and light variants are included if available
- Reference: `/home/mike/code/PodTui/opencode/packages/opencode/src/cli/cmd/tui/context/theme/`
