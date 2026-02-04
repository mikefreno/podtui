# 25. Implement 8-Character Code Validation Flow

meta:
  id: podcast-tui-app-25
  feature: podcast-tui-app
  priority: P2
  depends_on: [24]
  tags: [code-validation, auth, sync, solidjs]

objective:
- Create 8-character code input component
- Implement code validation logic
- Handle code submission
- Show validation results

deliverables:
- `src/components/CodeInput.tsx` with code field
- `src/utils/code-validator.ts` with validation logic
- `src/components/CodeValidationResult.tsx` with result display

steps:
- Create `src/utils/code-validator.ts`:
  - `validateCode(code: string): boolean`
  - Check length (8 characters)
  - Check format (alphanumeric)
  - Validate against stored codes
- Create `src/components/CodeInput.tsx`:
  - 8-character code input
  - Auto-formatting
  - Clear button
  - Validation error display
- Create `src/components/CodeValidationResult.tsx`:
  - Success message
  - Error message
  - Retry button
  - Link to alternative auth

tests:
- Unit: Test code validation logic
- Unit: Test code input formatting
- Unit: Test validation result display

acceptance_criteria:
- Code input accepts 8 characters
- Validation checks length and format
- Validation results display correctly
- Error handling works

validation:
- Run application and test code validation
- Enter valid 8-character code
- Enter invalid code
- Test validation error display

notes:
- Code format: alphanumeric (A-Z, 0-9)
- No real backend validation
- Store codes in localStorage for testing
- Link to OAuth placeholder
- Link to email/password login
