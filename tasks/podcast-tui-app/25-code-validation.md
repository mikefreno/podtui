# 24. Build Simple Login Screen (Email/Password)

meta:
  id: podcast-tui-app-24
  feature: podcast-tui-app
  priority: P2
  depends_on: [23]
  tags: [login, auth, form, solidjs, opentui]

objective:
- Create login screen component
- Implement email input field
- Implement password input field
- Add login validation and error handling

deliverables:
- `src/components/LoginScreen.tsx` with login form
- `src/components/EmailInput.tsx` with email field
- `src/components/PasswordInput.tsx` with password field
- `src/components/LoginButton.tsx` with submit button

steps:
- Create `src/components/EmailInput.tsx`:
  - Email input field using `<input>` component
  - Email validation regex
  - Error message display
  - Focus state styling
- Create `src/components/PasswordInput.tsx`:
  - Password input field
  - Show/hide password toggle
  - Password validation rules
  - Error message display
- Create `src/components/LoginButton.tsx`:
  - Submit button
  - Loading state
  - Disabled state
  - Error state
- Create `src/components/LoginScreen.tsx`:
  - Combine inputs and button
  - Login form validation
  - Error handling
  - Link to code validation
  - Link to OAuth placeholder

tests:
- Unit: Test email validation
- Unit: Test password validation
- Unit: Test login form submission
- Integration: Test login screen displays correctly

acceptance_criteria:
- Login screen accepts email and password
- Validation works correctly
- Error messages display properly
- Form submission handled

validation:
- Run application and navigate to login
- Enter valid credentials
- Enter invalid credentials
- Test error handling

notes:
- Use OpenTUI `<input>` component
- Email validation: regex pattern
- Password validation: minimum length
- No real authentication, just UI
- Link to code validation for sync
- Link to OAuth placeholder
