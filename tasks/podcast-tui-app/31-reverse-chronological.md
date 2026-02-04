# 30. Implement Feed Source Management (Add/Remove Sources)

meta:
  id: podcast-tui-app-30
  feature: podcast-tui-app
  priority: P1
  depends_on: [29]
  tags: [source-management, feeds, solidjs, opentui]

objective:
- Create source management component
- Implement add new source functionality
- Implement remove source functionality
- Manage enabled/disabled sources

deliverables:
- `src/components/SourceManager.tsx` with source management UI
- `src/components/AddSourceForm.tsx` with add source form
- `src/components/SourceListItem.tsx` with individual source

steps:
- Create `src/components/SourceManager.tsx`:
  - List of enabled sources
  - Add source button
  - Remove source button
  - Enable/disable toggle
  - Source count display
- Create `src/components/AddSourceForm.tsx`:
  - Source name input
  - Source URL input
  - Source type selection
  - API key input (if required)
  - Submit button
  - Validation
- Create `src/components/SourceListItem.tsx`:
  - Display source info
  - Enable/disable toggle
  - Remove button
  - Status indicator
- Add source manager to settings screen

tests:
- Unit: Test source list displays correctly
- Unit: Test add source form validation
- Unit: Test remove source functionality
- Integration: Test source management workflow

acceptance_criteria:
- Source list displays all sources
- Add source form validates input
- Remove source works correctly
- Enable/disable toggles work

validation:
- Run application and navigate to settings
- Test add source
- Test remove source
- Test enable/disable toggle
- Verify feeds from new sources appear

notes:
- Source types: RSS, API, Custom
- RSS sources: feed URLs
- API sources: require API key
- Custom sources: user-defined
- Add validation for source URLs
- Store sources in localStorage
