# 15. Build Responsive Layout System (Flexbox)

meta:
  id: podcast-tui-app-15
  feature: podcast-tui-app
  priority: P0
  depends_on: [14]
  tags: [layout, flexbox, responsive, solidjs, opentui]

objective:
- Create reusable Flexbox layout components
- Handle terminal resizing gracefully
- Ensure responsive design across different terminal sizes
- Build layout patterns for common UI patterns

deliverables:
- `src/components/BoxLayout.tsx` with Flexbox container
- `src/components/Row.tsx` with horizontal layout
- `src/components/Column.tsx` with vertical layout
- `src/components/ResponsiveContainer.tsx` with resizing logic

steps:
- Create `src/components/BoxLayout.tsx`:
  - Generic Flexbox container
  - Props: flexDirection, justifyContent, alignItems, gap
  - Use OpenTUI layout patterns
- Create `src/components/Row.tsx`:
  - Horizontal layout (flexDirection="row")
  - Props for spacing and alignment
  - Handle overflow
- Create `src/components/Column.tsx`:
  - Vertical layout (flexDirection="column")
  - Props for spacing and alignment
  - Scrollable content area
- Create `src/components/ResponsiveContainer.tsx`:
  - Listen to terminal resize events
  - Adjust layout based on width/height
  - Handle different screen sizes
- Add usage examples and documentation

tests:
- Unit: Test BoxLayout with different props
- Unit: Test Row and Column layouts
- Integration: Test responsive behavior on resize
- Integration: Test layouts fit within terminal bounds

acceptance_criteria:
- BoxLayout renders with correct Flexbox properties
- Row and Column layouts work correctly
- ResponsiveContainer adapts to terminal resize
- All layouts fit within terminal bounds

validation:
- Run application and test layouts
- Resize terminal and verify responsive behavior
- Test with different terminal sizes
- Check layouts don't overflow

notes:
- Use OpenTUI Flexbox patterns from `layout/REFERENCE.md`
- Terminal dimensions: width (columns) x height (rows)
- Handle edge cases (very small screens)
- Add comments explaining layout decisions
