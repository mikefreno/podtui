/**
 * Authentication configuration for PodTUI
 * Authentication is DISABLED by default - users can opt-in
 */

import { OAuthProvider, type OAuthProviderConfig } from "../types/auth"

/** Default auth enabled state - DISABLED by default */
export const DEFAULT_AUTH_ENABLED = false

/** Authentication configuration */
export const AUTH_CONFIG = {
  /** Whether auth is enabled by default */
  defaultEnabled: DEFAULT_AUTH_ENABLED,

  /** Code validation settings */
  codeValidation: {
    /** Code length (8 characters) */
    codeLength: 8,
    /** Allowed characters (alphanumeric) */
    allowedChars: /^[A-Z0-9]+$/,
    /** Code expiration time in minutes */
    expirationMinutes: 15,
  },

  /** Password requirements */
  password: {
    minLength: 8,
    requireUppercase: false,
    requireLowercase: false,
    requireNumber: false,
    requireSpecial: false,
  },

  /** Email validation */
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },

  /** Local storage keys */
  storage: {
    authState: "podtui_auth_state",
    user: "podtui_user",
    lastLogin: "podtui_last_login",
  },
} as const

/** OAuth provider configurations */
export const OAUTH_PROVIDERS: OAuthProviderConfig[] = [
  {
    id: OAuthProvider.GOOGLE,
    name: "Google",
    enabled: false, // Not feasible in terminal
    description: "Sign in with Google (requires browser redirect)",
  },
  {
    id: OAuthProvider.APPLE,
    name: "Apple",
    enabled: false, // Not feasible in terminal
    description: "Sign in with Apple (requires browser redirect)",
  },
]

/** Terminal OAuth limitation message */
export const OAUTH_LIMITATION_MESSAGE = `
OAuth authentication (Google, Apple) is not directly available in terminal applications.

To use OAuth:
1. Visit the web portal in your browser
2. Sign in with your preferred provider
3. Generate a sync code
4. Enter the code here to link your account

Alternatively, use email/password authentication or file-based sync.
`.trim()
