/**
 * Code validation component for PodTUI
 * 8-character alphanumeric code input for sync authentication
 */

import { createSignal } from "solid-js"
import { useAuthStore } from "../stores/auth"
import { AUTH_CONFIG } from "../config/auth"

interface CodeValidationProps {
  focused?: boolean
  onBack?: () => void
}

type FocusField = "code" | "submit" | "back"

export function CodeValidation(props: CodeValidationProps) {
  const auth = useAuthStore()
  const [code, setCode] = createSignal("")
  const [focusField, setFocusField] = createSignal<FocusField>("code")
  const [codeError, setCodeError] = createSignal<string | null>(null)

  const fields: FocusField[] = ["code", "submit", "back"]

  /** Format code as user types (uppercase, alphanumeric only) */
  const handleCodeInput = (value: string) => {
    const formatted = value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    // Limit to max length
    const limited = formatted.slice(0, AUTH_CONFIG.codeValidation.codeLength)
    setCode(limited)

    // Clear error when typing
    if (codeError()) {
      setCodeError(null)
    }
  }

  const validateCode = (value: string): boolean => {
    if (!value) {
      setCodeError("Code is required")
      return false
    }
    if (value.length !== AUTH_CONFIG.codeValidation.codeLength) {
      setCodeError(`Code must be ${AUTH_CONFIG.codeValidation.codeLength} characters`)
      return false
    }
    if (!AUTH_CONFIG.codeValidation.allowedChars.test(value)) {
      setCodeError("Code must contain only letters and numbers")
      return false
    }
    setCodeError(null)
    return true
  }

  const handleSubmit = async () => {
    if (!validateCode(code())) {
      return
    }

    const success = await auth.validateCode(code())
    if (!success && auth.error) {
      setCodeError(auth.error.message)
    }
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
      } else if (focusField() === "back" && props.onBack) {
        props.onBack()
      }
    } else if (key.name === "escape" && props.onBack) {
      props.onBack()
    }
  }

  const codeProgress = () => {
    const len = code().length
    const max = AUTH_CONFIG.codeValidation.codeLength
    return `${len}/${max}`
  }

  const codeDisplay = () => {
    const current = code()
    const max = AUTH_CONFIG.codeValidation.codeLength
    const filled = current.split("")
    const empty = Array(max - filled.length).fill("_")
    return [...filled, ...empty].join(" ")
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
        <strong>Enter Sync Code</strong>
      </text>

      <box height={1} />

      <text>
        <span fg="gray">
          Enter your 8-character sync code to link your account.
        </span>
      </text>
      <text>
        <span fg="gray">
          You can get this code from the web portal.
        </span>
      </text>

      <box height={1} />

      {/* Code display */}
      <box flexDirection="column" gap={0}>
        <text>
          <span fg={focusField() === "code" ? "cyan" : undefined}>
            Code ({codeProgress()}):
          </span>
        </text>

        <box border padding={1}>
          <text>
            <span
              fg={code().length === AUTH_CONFIG.codeValidation.codeLength ? "green" : "yellow"}
            >
              {codeDisplay()}
            </span>
          </text>
        </box>

        {/* Hidden input for actual typing */}
        <input
          value={code()}
          onInput={handleCodeInput}
          placeholder=""
          focused={props.focused && focusField() === "code"}
          width={30}
        />

        {codeError() && (
          <text>
            <span fg="red">{codeError()}</span>
          </text>
        )}
      </box>

      <box height={1} />

      {/* Action buttons */}
      <box flexDirection="row" gap={2}>
        <box
          border
          padding={1}
          backgroundColor={focusField() === "submit" ? "#333" : undefined}
        >
          <text>
            <span fg={focusField() === "submit" ? "cyan" : undefined}>
              {auth.isLoading ? "Validating..." : "[Enter] Validate Code"}
            </span>
          </text>
        </box>

        <box
          border
          padding={1}
          backgroundColor={focusField() === "back" ? "#333" : undefined}
        >
          <text>
            <span fg={focusField() === "back" ? "yellow" : "gray"}>
              [Esc] Back to Login
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

      <text>
        <span fg="gray">Tab to navigate, Enter to select, Esc to go back</span>
      </text>
    </box>
  )
}
