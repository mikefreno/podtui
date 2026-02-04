# 20. Create File Picker UI for Import

meta:
  id: podcast-tui-app-20
  feature: podcast-tui-app
  priority: P1
  depends_on: [19]
  tags: [file-picker, input, ui, solidjs, opentui]

objective:
- Create file picker component for selecting import files
- Implement file format detection
- Display file information
- Handle file selection and validation

deliverables:
- `src/components/FilePicker.tsx` with file picker UI
- `src/components/FileInfo.tsx` with file details
- `src/utils/file-detector.ts` with format detection

steps:
- Create `src/utils/file-detector.ts`:
  - `detectFormat(file: File): 'json' | 'xml' | 'unknown'`
  - Read file header
  - Check file extension
  - Validate format
- Create `src/components/FilePicker.tsx`:
  - File input using `<input>` component
  - Accept JSON and XML files
  - File selection handler
  - Clear button
- Create `src/components/FileInfo.tsx`:
  - Display file name
  - Display file size
  - Display file format
  - Display last modified date
- Add file picker to import dialog

tests:
- Unit: Test format detection
- Unit: Test file picker selection
- Integration: Test file validation

acceptance_criteria:
- File picker allows selecting files
- Format detection works correctly
- File information is displayed
- Invalid files are rejected

validation:
- Run application and test file picker
- Select valid files
- Select invalid files
- Verify format detection

notes:
- Use OpenTUI `<input>` component for file picker
- Accept `.json` and `.xml` extensions
- Check file size limit (e.g., 10MB)
- Add file type validation
- Handle file selection errors
