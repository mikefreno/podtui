/**
 * Authentication types for PodTUI
 * Authentication is optional and disabled by default
 */

/** User profile information */
export interface User {
  id: string
  email: string
  name: string
  createdAt: Date
  lastLoginAt?: Date
  syncEnabled: boolean
}

/** Authentication state */
export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: AuthError | null
}

/** Authentication error */
export interface AuthError {
  code: AuthErrorCode
  message: string
}

/** Error codes for authentication */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  INVALID_CODE = "INVALID_CODE",
  CODE_EXPIRED = "CODE_EXPIRED",
  NETWORK_ERROR = "NETWORK_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/** Login credentials */
export interface LoginCredentials {
  email: string
  password: string
}

/** Code validation request */
export interface CodeValidationRequest {
  code: string
}

/** OAuth provider types */
export enum OAuthProvider {
  GOOGLE = "google",
  APPLE = "apple",
}

/** OAuth provider configuration */
export interface OAuthProviderConfig {
  id: OAuthProvider
  name: string
  enabled: boolean
  description: string
}

/** Auth screen types for navigation */
export type AuthScreen = "login" | "code" | "oauth" | "profile"
