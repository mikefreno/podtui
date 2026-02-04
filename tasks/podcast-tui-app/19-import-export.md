# 18. Create Sync Data Models (JSON/XML Formats)

meta:
  id: podcast-tui-app-18
  feature: podcast-tui-app
  priority: P1
  depends_on: [17]
  tags: [data-models, json, xml, sync, typescript]

objective:
- Define TypeScript interfaces for JSON sync format
- Define TypeScript interfaces for XML sync format
- Ensure compatibility between formats
- Add validation logic

deliverables:
- `src/types/sync-json.ts` with JSON sync types
- `src/types/sync-xml.ts` with XML sync types
- `src/utils/sync-validation.ts` with validation logic
- `src/constants/sync-formats.ts` with format definitions

steps:
- Create `src/types/sync-json.ts`:
  - `SyncData` interface with all required fields
  - Include feeds, sources, settings, preferences
  - Add version field for format compatibility
  - Add timestamp for last sync
- Create `src/types/sync-xml.ts`:
  - `SyncDataXML` interface
  - XML-compatible type definitions
  - Root element and child elements
  - Attributes for metadata
- Create `src/utils/sync-validation.ts`:
  - `validateJSONSync(data: unknown): SyncData`
  - `validateXMLSync(data: unknown): SyncDataXML`
  - Field validation functions
  - Type checking
- Create `src/constants/sync-formats.ts`:
  - JSON format version
  - XML format version
  - Supported versions list
  - Format extensions

tests:
- Unit: Test JSON validation with valid/invalid data
- Unit: Test XML validation with valid/invalid data
- Integration: Test format compatibility

acceptance_criteria:
- JSON sync types compile without errors
- XML sync types compile without errors
- Validation rejects invalid data
- Format versions are tracked

validation:
- Run `bun run build` to verify TypeScript
- Test validation with sample data
- Test with invalid data to verify rejection

notes:
- JSON format: Simple, human-readable
- XML format: More structured, better for complex data
- Include all necessary fields for complete sync
- Add comments explaining each field
- Ensure backward compatibility
