/**
 * OAuth placeholder component for PodTUI
 * Displays OAuth limitations and alternative authentication methods
 */

import { createSignal } from "solid-js"
import { OAUTH_PROVIDERS, OAUTH_LIMITATION_MESSAGE } from "../config/auth"

interface OAuthPlaceholderProps {
  focused?: boolean
  onBack?: () => void
  onNavigateToCode?: () => void
}

type FocusField = "code" | "back"

export function OAuthPlaceholder(props: OAuthPlaceholderProps) {
  const [focusField, setFocusField] = createSignal<FocusField>("code")

  const fields: FocusField[] = ["code", "back"]

  const handleKeyPress = (key: { name: string; shift?: boolean }) => {
    if (key.name === "tab") {
      const currentIndex = fields.indexOf(focusField())
      const nextIndex = key.shift
        ? (currentIndex - 1 + fields.length) % fields.length
        : (currentIndex + 1) % fields.length
      setFocusField(fields[nextIndex])
    } else if (key.name === "return" || key.name === "enter") {
      if (focusField() === "code" && props.onNavigateToCode) {
        props.onNavigateToCode()
      } else if (focusField() === "back" && props.onBack) {
        props.onBack()
      }
    } else if (key.name === "escape" && props.onBack) {
      props.onBack()
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
        <strong>OAuth Authentication</strong>
      </text>

      <box height={1} />

      {/* OAuth providers list */}
      <text>
        <span fg="cyan">Available OAuth Providers:</span>
      </text>

      <box flexDirection="column" gap={0} paddingLeft={2}>
        {OAUTH_PROVIDERS.map((provider) => (
          <text>
            <span fg={provider.enabled ? "green" : "gray"}>
              {provider.enabled ? "[+]" : "[-]"} {provider.name}
            </span>
            <span fg="gray"> - {provider.description}</span>
          </text>
        ))}
      </box>

      <box height={1} />

      {/* Limitation message */}
      <box border padding={1} borderColor="yellow">
        <text>
          <span fg="yellow">Terminal Limitations</span>
        </text>
      </box>

      <box paddingLeft={1}>
        {OAUTH_LIMITATION_MESSAGE.split("\n").map((line) => (
          <text>
            <span fg="gray">{line}</span>
          </text>
        ))}
      </box>

      <box height={1} />

      {/* Alternative options */}
      <text>
        <span fg="cyan">Recommended Alternatives:</span>
      </text>

      <box flexDirection="column" gap={0} paddingLeft={2}>
        <text>
          <span fg="green">[1]</span>
          <span fg="white"> Use a sync code from the web portal</span>
        </text>
        <text>
          <span fg="green">[2]</span>
          <span fg="white"> Use email/password authentication</span>
        </text>
        <text>
          <span fg="green">[3]</span>
          <span fg="white"> Use file-based sync (no account needed)</span>
        </text>
      </box>

      <box height={1} />

      {/* Action buttons */}
      <box flexDirection="row" gap={2}>
        <box
          border
          padding={1}
          backgroundColor={focusField() === "code" ? "#333" : undefined}
        >
          <text>
            <span fg={focusField() === "code" ? "cyan" : undefined}>
              [C] Enter Sync Code
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

      <box height={1} />

      <text>
        <span fg="gray">Tab to navigate, Enter to select, Esc to go back</span>
      </text>
    </box>
  )
}
