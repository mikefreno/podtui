/**
 * Login screen component for PodTUI
 * Email/password login with links to code validation and OAuth
 */

import { createSignal } from "solid-js"
import { useAuthStore } from "../stores/auth"
import { AUTH_CONFIG } from "../config/auth"

interface LoginScreenProps {
  focused?: boolean
  onNavigateToCode?: () => void
  onNavigateToOAuth?: () => void
}

type FocusField = "email" | "password" | "submit" | "code" | "oauth"

export function LoginScreen(props: LoginScreenProps) {
  const auth = useAuthStore()
  const [email, setEmail] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [focusField, setFocusField] = createSignal<FocusField>("email")
  const [emailError, setEmailError] = createSignal<string | null>(null)
  const [passwordError, setPasswordError] = createSignal<string | null>(null)

  const fields: FocusField[] = ["email", "password", "submit", "code", "oauth"]

  const validateEmail = (value: string): boolean => {
    if (!value) {
      setEmailError("Email is required")
      return false
    }
    if (!AUTH_CONFIG.email.pattern.test(value)) {
      setEmailError("Invalid email format")
      return false
    }
    setEmailError(null)
    return true
  }

  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError("Password is required")
      return false
    }
    if (value.length < AUTH_CONFIG.password.minLength) {
      setPasswordError(`Minimum ${AUTH_CONFIG.password.minLength} characters`)
      return false
    }
    setPasswordError(null)
    return true
  }

  const handleSubmit = async () => {
    const isEmailValid = validateEmail(email())
    const isPasswordValid = validatePassword(password())

    if (!isEmailValid || !isPasswordValid) {
      return
    }

    await auth.login({ email: email(), password: password() })
  }

  const handleKeyPress = (key: { name: string; shift?: boolean }) => {
    if (key.name === "tab") {
      const currentIndex = fields.indexOf(focusField())
      const nextIndex = key.shift
        ? (currentIndex - 1 + fields.length) % fields.length
        : (currentIndex + 1) % fields.length
      setFocusField(fields[nextIndex])
    } else if (key.name === "return" || key.name === "enter") {
      if (focusField() === "submit") {
        handleSubmit()
      } else if (focusField() === "code" && props.onNavigateToCode) {
        props.onNavigateToCode()
      } else if (focusField() === "oauth" && props.onNavigateToOAuth) {
        props.onNavigateToOAuth()
      }
    }
  }

  return (
    <box
      flexDirection="column"
      border
      padding={2}
      gap={1}
      onKeyPress={props.focused ? handleKeyPress : undefined}
    >
      <text>
        <strong>Sign In</strong>
      </text>

      <box height={1} />

      {/* Email field */}
      <box flexDirection="column" gap={0}>
        <text>
          <span fg={focusField() === "email" ? "cyan" : undefined}>
            Email:
          </span>
        </text>
        <input
          value={email()}
          onInput={setEmail}
          placeholder="your@email.com"
          focused={props.focused && focusField() === "email"}
          width={30}
        />
        {emailError() && (
          <text>
            <span fg="red">{emailError()}</span>
          </text>
        )}
      </box>

      {/* Password field */}
      <box flexDirection="column" gap={0}>
        <text>
          <span fg={focusField() === "password" ? "cyan" : undefined}>
            Password:
          </span>
        </text>
        <input
          value={password()}
          onInput={setPassword}
          placeholder="********"
          focused={props.focused && focusField() === "password"}
          width={30}
        />
        {passwordError() && (
          <text>
            <span fg="red">{passwordError()}</span>
          </text>
        )}
      </box>

      <box height={1} />

      {/* Submit button */}
      <box flexDirection="row" gap={2}>
        <box
          border
          padding={1}
          backgroundColor={focusField() === "submit" ? "#333" : undefined}
        >
          <text>
            <span fg={focusField() === "submit" ? "cyan" : undefined}>
              {auth.isLoading ? "Signing in..." : "[Enter] Sign In"}
            </span>
          </text>
        </box>
      </box>

      {/* Auth error message */}
      {auth.error && (
        <text>
          <span fg="red">{auth.error.message}</span>
        </text>
      )}

      <box height={1} />

      {/* Alternative auth options */}
      <text>
        <span fg="gray">Or authenticate with:</span>
      </text>

      <box flexDirection="row" gap={2}>
        <box
          border
          padding={1}
          backgroundColor={focusField() === "code" ? "#333" : undefined}
        >
          <text>
            <span fg={focusField() === "code" ? "yellow" : "gray"}>
              [C] Sync Code
            </span>
          </text>
        </box>

        <box
          border
          padding={1}
          backgroundColor={focusField() === "oauth" ? "#333" : undefined}
        >
          <text>
            <span fg={focusField() === "oauth" ? "yellow" : "gray"}>
              [O] OAuth Info
            </span>
          </text>
        </box>
      </box>

      <box height={1} />

      <text>
        <span fg="gray">Tab to navigate, Enter to select</span>
      </text>
    </box>
  )
}
