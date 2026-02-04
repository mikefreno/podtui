/**
 * Authentication store for PodTUI
 * Uses Zustand for state management with localStorage persistence
 * Authentication is DISABLED by default
 */

import { createSignal } from "solid-js"
import type {
  User,
  AuthState,
  AuthError,
  AuthErrorCode,
  LoginCredentials,
  AuthScreen,
} from "../types/auth"
import { AUTH_CONFIG, DEFAULT_AUTH_ENABLED } from "../config/auth"

/** Initial auth state */
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
}

/** Load auth state from localStorage */
function loadAuthState(): AuthState {
  if (typeof localStorage === "undefined") {
    return initialState
  }

  try {
    const stored = localStorage.getItem(AUTH_CONFIG.storage.authState)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Convert date strings back to Date objects
      if (parsed.user?.createdAt) {
        parsed.user.createdAt = new Date(parsed.user.createdAt)
      }
      if (parsed.user?.lastLoginAt) {
        parsed.user.lastLoginAt = new Date(parsed.user.lastLoginAt)
      }
      return parsed
    }
  } catch {
    // Ignore parse errors, use initial state
  }

  return initialState
}

/** Save auth state to localStorage */
function saveAuthState(state: AuthState): void {
  if (typeof localStorage === "undefined") {
    return
  }

  try {
    localStorage.setItem(AUTH_CONFIG.storage.authState, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

/** Create auth store using Solid signals */
export function createAuthStore() {
  const [state, setState] = createSignal<AuthState>(loadAuthState())
  const [authEnabled, setAuthEnabled] = createSignal(DEFAULT_AUTH_ENABLED)
  const [currentScreen, setCurrentScreen] = createSignal<AuthScreen>("login")

  /** Update state and persist */
  const updateState = (updates: Partial<AuthState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates }
      saveAuthState(next)
      return next
    })
  }

  /** Login with email/password (placeholder - no real backend) */
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    updateState({ isLoading: true, error: null })

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 500))

    // Validate email format
    if (!AUTH_CONFIG.email.pattern.test(credentials.email)) {
      updateState({
        isLoading: false,
        error: {
          code: "INVALID_CREDENTIALS" as AuthErrorCode,
          message: "Invalid email format",
        },
      })
      return false
    }

    // Validate password length
    if (credentials.password.length < AUTH_CONFIG.password.minLength) {
      updateState({
        isLoading: false,
        error: {
          code: "INVALID_CREDENTIALS" as AuthErrorCode,
          message: `Password must be at least ${AUTH_CONFIG.password.minLength} characters`,
        },
      })
      return false
    }

    // Create mock user (in real app, this would validate against backend)
    const user: User = {
      id: crypto.randomUUID(),
      email: credentials.email,
      name: credentials.email.split("@")[0],
      createdAt: new Date(),
      lastLoginAt: new Date(),
      syncEnabled: true,
    }

    updateState({
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    })

    return true
  }

  /** Logout and clear state */
  const logout = () => {
    updateState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
    setCurrentScreen("login")
  }

  /** Validate 8-character code */
  const validateCode = async (code: string): Promise<boolean> => {
    updateState({ isLoading: true, error: null })

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 500))

    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "")

    // Check code length
    if (normalizedCode.length !== AUTH_CONFIG.codeValidation.codeLength) {
      updateState({
        isLoading: false,
        error: {
          code: "INVALID_CODE" as AuthErrorCode,
          message: `Code must be ${AUTH_CONFIG.codeValidation.codeLength} characters`,
        },
      })
      return false
    }

    // Check code format
    if (!AUTH_CONFIG.codeValidation.allowedChars.test(normalizedCode)) {
      updateState({
        isLoading: false,
        error: {
          code: "INVALID_CODE" as AuthErrorCode,
          message: "Code must contain only letters and numbers",
        },
      })
      return false
    }

    // Mock successful code validation
    const user: User = {
      id: crypto.randomUUID(),
      email: `sync-${normalizedCode.toLowerCase()}@podtui.local`,
      name: `Sync User (${normalizedCode.slice(0, 4)})`,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      syncEnabled: true,
    }

    updateState({
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    })

    return true
  }

  /** Clear error */
  const clearError = () => {
    updateState({ error: null })
  }

  /** Enable/disable auth */
  const toggleAuthEnabled = () => {
    setAuthEnabled((prev) => !prev)
  }

  return {
    // State accessors (signals)
    state,
    authEnabled,
    currentScreen,

    // Actions
    login,
    logout,
    validateCode,
    clearError,
    setCurrentScreen,
    toggleAuthEnabled,

    // Computed
    get user() {
      return state().user
    },
    get isAuthenticated() {
      return state().isAuthenticated
    },
    get isLoading() {
      return state().isLoading
    },
    get error() {
      return state().error
    },
  }
}

/** Singleton auth store instance */
let authStoreInstance: ReturnType<typeof createAuthStore> | null = null

/** Get or create auth store */
export function useAuthStore() {
  if (!authStoreInstance) {
    authStoreInstance = createAuthStore()
  }
  return authStoreInstance
}
