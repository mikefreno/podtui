# 68. Build QR Code Display for Mobile Verification

meta:
  id: podcast-tui-app-68
  feature: podcast-tui-app
  priority: P2
  depends_on: [04]
  tags: [authentication, qr-code, mobile, verification, solidjs]

objective:
- Display QR code for mobile device verification
- Generate QR code from verification URL
- Handle manual code entry as fallback
- Show verification status and expiration

deliverables:
- `/src/components/QrCodeDisplay.tsx` - QR code display component
- `/src/utils/qr-code-generator.ts` - QR code generation utility
- `/src/auth/verification-handler.ts` - Verification flow handler
- Updated `/src/auth/login-screen.tsx` with QR code option
- Updated `/src/auth/code-validation.tsx` for manual entry

steps:
- Integrate QR code generation library (e.g., `qrcode` package)
- Create QRCodeDisplay component with generated QR image
- Implement verification URL generation
- Add manual code entry fallback UI
- Show verification expiration timer
- Display verification success/failure status
- Handle QR code scan timeout
- Update authentication state on successful verification

tests:
- Unit: Test QR code generation
- Unit: Test verification URL generation
- Unit: Test verification code validation
- Integration: Test complete verification flow

acceptance_criteria:
- QR code is generated correctly from verification URL
- QR code is displayed in terminal
- Manual code entry works as fallback
- Verification status is shown clearly
- Verification expires after timeout
- Successful verification updates auth state

validation:
- Run `bun run build` to verify TypeScript compilation
- Test QR code display manually
- Test manual code entry fallback
- Verify verification flow works end-to-end

notes:
- Use `qrcode` or similar library for QR generation
- Display QR code in ASCII or image format
- Consider using external scanner app
- Add verification expiration (e.g., 5 minutes)
- Document mobile app requirements for scanning
