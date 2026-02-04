# 19. Build Import/Export Functionality

meta:
  id: podcast-tui-app-19
  feature: podcast-tui-app
  priority: P1
  depends_on: [18]
  tags: [import-export, file-io, sync, solidjs]

objective:
- Implement JSON export functionality
- Implement JSON import functionality
- Implement XML export functionality
- Implement XML import functionality
- Handle file operations and errors

deliverables:
- `src/utils/sync.ts` with import/export functions
- `src/components/ExportDialog.tsx` with export UI
- `src/components/ImportDialog.tsx` with import UI
- Error handling components

steps:
- Implement JSON export in `src/utils/sync.ts`:
  - `exportFeedsToJSON(feeds: Feed[]): string`
  - `exportSettingsToJSON(settings: Settings): string`
  - Combine into `exportToJSON(data: SyncData): string`
- Implement JSON import in `src/utils/sync.ts`:
  - `importFeedsFromJSON(json: string): Feed[]`
  - `importSettingsFromJSON(json: string): Settings`
  - Combine into `importFromJSON(json: string): SyncData`
- Implement XML export in `src/utils/sync.ts`:
  - `exportToXML(data: SyncDataXML): string`
  - XML serialization
- Implement XML import in `src/utils/sync.ts`:
  - `importFromXML(xml: string): SyncDataXML`
  - XML parsing
- Create `src/components/ExportDialog.tsx`:
  - File name input
  - Export format selection
  - Export button
  - Success message
- Create `src/components/ImportDialog.tsx`:
  - File picker
  - Format detection
  - Import button
  - Error message display

tests:
- Unit: Test JSON import/export with sample data
- Unit: Test XML import/export with sample data
- Unit: Test error handling
- Integration: Test file operations

acceptance_criteria:
- Export creates valid files
- Import loads data correctly
- Errors are handled gracefully
- Files can be opened in text editors

validation:
- Run application and test export/import
- Open exported files in text editor
- Test with different data sizes
- Test error cases (invalid files)

notes:
- Use `FileReader` API for file operations
- Handle file not found, invalid format, permission errors
- Add progress indicator for large files
- Support both JSON and XML formats
- Ensure data integrity during import
