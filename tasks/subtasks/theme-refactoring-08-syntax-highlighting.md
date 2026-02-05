# 08. Add Syntax Highlighting Integration

meta:
  id: theme-refactoring-08
  feature: theme-refactoring-json-format
  priority: P1
  depends_on: [theme-refactoring-04, theme-refactoring-05]
  tags: [implementation, syntax]

objective:
- Add syntax highlighting support using theme colors
- Generate syntax rules from theme definitions
- Support markdown syntax highlighting
- Integrate with OpenTUI syntax highlighting

deliverables:
- `src/utils/syntax-highlighter.ts` - Syntax highlighting utilities
- `src/utils/syntax-rules.ts` - Syntax rule generation

steps:
- Step 8.1: Create `src/utils/syntax-rules.ts`
  - Implement `getSyntaxRules(theme: ThemeColors)` function
  - Define syntax scopes and their mappings
  - Map theme colors to syntax scopes:
    - Default text
    - Keywords (return, conditional, repeat, coroutine)
    - Types (function, class, module)
    - Variables (parameter, member, builtin)
    - Strings, numbers, booleans
    - Comments
    - Operators and punctuation
    - Markdown-specific scopes (headings, bold, italic, links)
    - Diff scopes (added, removed, context)
  - Add style properties (foreground, bold, italic, underline)

- Step 8.2: Create `src/utils/syntax-highlighter.ts`
  - Implement `generateSyntax(theme: ThemeColors)` function
  - Implement `generateSubtleSyntax(theme: ThemeColors)` function
  - Apply opacity to syntax colors for subtle highlighting
  - Use theme's `thinkingOpacity` property

- Step 8.3: Integrate with OpenTUI syntax highlighting
  - Import `SyntaxStyle` from `@opentui/core`
  - Use `SyntaxStyle.fromTheme()` to create syntax styles
  - Apply syntax styles to code components

- Step 8.4: Add syntax scope mappings
  - Map common programming language scopes
  - Map markdown and markup scopes
  - Map diff and git scopes
  - Add scope aliases for common patterns

tests:
- Unit:
  - Test `getSyntaxRules` generates correct rules
  - Test `generateSyntax` creates valid syntax styles
  - Test `generateSubtleSyntax` applies opacity correctly
  - Test syntax rules cover all expected scopes

- Integration/e2e:
  - Test syntax highlighting with different themes
  - Verify syntax colors match theme definitions
  - Test markdown highlighting

acceptance_criteria:
- `src/utils/syntax-rules.ts` file exists with rule generation
- `src/utils/syntax-highlighter.ts` file exists with style generation
- Syntax highlighting works with theme colors
- Markdown highlighting is supported
- Syntax rules cover common programming patterns

validation:
- Run: `bun run typecheck` - Should pass
- Run: `bun test src/utils/syntax-rules.test.ts`
- Run: `bun test src/utils/syntax-highlighter.test.ts`
- Test syntax highlighting in application
- Verify syntax colors are readable

notes:
- Use opencode's syntax rule generation as reference
- Include comprehensive scope mappings
- Support common programming languages
- Reference: `/home/mike/code/PodTui/opencode/packages/opencode/src/cli/cmd/tui/context/theme.tsx` (lines 622-1152)
