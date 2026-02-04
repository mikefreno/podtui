# 03. Implement Direct File Sync (JSON/XML Import/Export)

meta:
  id: podcast-tui-app-03
  feature: podcast-tui-app
  priority: P1
  depends_on: [02]
  tags: [file-sync, json, xml, import-export, solidjs]

objective:
- Create data models for JSON and XML sync formats
- Implement import functionality to load feeds and settings from files
- Implement export functionality to save feeds and settings to files
- Add file picker UI for selecting files

deliverables:
- `src/types/sync.ts` with sync data models
- `src/utils/sync.ts` with import/export functions
- `src/components/SyncPanel.tsx` with sync UI
- File picker component for file selection

steps:
- Create `src/types/sync.ts` with data models:
  - `SyncData` interface for JSON format
  - `SyncDataXML` interface for XML format
  - Include fields: feeds, sources, settings, preferences
- Create `src/utils/sync.ts` with functions:
  - `exportToJSON(data: SyncData): string`
  - `importFromJSON(json: string): SyncData`
  - `exportToXML(data: SyncDataXML): string`
  - `importFromXML(xml: string): SyncDataXML`
  - Handle validation and error checking
- Create `src/components/SyncPanel.tsx` with:
  - Import button
  - Export button
  - File picker UI using `<input>` component
  - Sync status indicator
- Add sync functionality to Settings screen

tests:
- Unit: Test JSON import/export with sample data
- Unit: Test XML import/export with sample data
- Integration: Test file picker selects correct files
- Integration: Test sync panel buttons work correctly

acceptance_criteria:
- Export creates valid JSON file with all data
- Export creates valid XML file with all data
- Import loads data from JSON file
- Import loads data from XML file
- File picker allows selecting files from disk

validation:
- Run `bun run src/index.tsx`
- Go to Settings > Sync
- Click Export, verify file created
- Click Import, select file, verify data loaded
- Test with both JSON and XML formats

notes:
- JSON format: Simple, human-readable
- XML format: More structured, better for complex data
- Use `FileReader` API for file operations
- Handle file not found and invalid format errors
