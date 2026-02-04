# 47. Add Source Management UI

meta:
  id: podcast-tui-app-47
  feature: podcast-tui-app
  priority: P1
  depends_on: [46]
  tags: [source-management, settings, ui, solidjs]

objective:
- Create source management UI in settings
- List all enabled sources
- Add new source functionality
- Remove source functionality
- Enable/disable sources

deliverables:
- `src/components/SourceManager.tsx` with source management
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
  - Source type selection (RSS, API, Custom)
  - API key input (if required)
  - Submit button
  - Validation
- Create `src/components/SourceListItem.tsx`:
  - Display source info
  - Enable/disable toggle
  - Remove button
  - Status indicator (working, error)

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
- Show source status (working/error)
- Add error handling for failed sources
