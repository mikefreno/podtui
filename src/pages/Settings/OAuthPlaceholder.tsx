/**
 * OAuth placeholder component for PodTUI
 * Displays OAuth limitations and alternative authentication methods
 */

import { createSignal } from "solid-js";
import { OAUTH_PROVIDERS, OAUTH_LIMITATION_MESSAGE } from "@/config/auth";
import { useTheme } from "@/context/ThemeContext";

interface OAuthPlaceholderProps {
  focused?: boolean;
  onBack?: () => void;
  onNavigateToCode?: () => void;
}

type FocusField = "code" | "back";

export function OAuthPlaceholder(props: OAuthPlaceholderProps) {
  const { theme } = useTheme();
  const [focusField, setFocusField] = createSignal<FocusField>("code");

  const fields: FocusField[] = ["code", "back"];

  const handleKeyPress = (key: { name: string; shift?: boolean }) => {
    if (key.name === "tab") {
      const currentIndex = fields.indexOf(focusField());
      const nextIndex = key.shift
        ? (currentIndex - 1 + fields.length) % fields.length
        : (currentIndex + 1) % fields.length;
      setFocusField(fields[nextIndex]);
    } else if (key.name === "return") {
      if (focusField() === "code" && props.onNavigateToCode) {
        props.onNavigateToCode();
      } else if (focusField() === "back" && props.onBack) {
        props.onBack();
      }
    } else if (key.name === "escape" && props.onBack) {
      props.onBack();
    }
  };

  return (
    <box flexDirection="column" border padding={2} gap={1} borderColor={theme.border}>
      <text fg={theme.text}>
        <strong>OAuth Authentication</strong>
      </text>

      <box height={1} />

      {/* OAuth providers list */}
      <text fg={theme.primary}>Available OAuth Providers:</text>

      <box flexDirection="column" gap={0} paddingLeft={2}>
        {OAUTH_PROVIDERS.map((provider) => (
          <box flexDirection="row" gap={1}>
            <text fg={provider.enabled ? theme.success : theme.textMuted}>
              {provider.enabled ? "[+]" : "[-]"} {provider.name}
            </text>
            <text fg={theme.textMuted}>- {provider.description}</text>
          </box>
        ))}
      </box>

      <box height={1} />

      {/* Limitation message */}
      <box border padding={1} borderColor={theme.warning}>
        <text fg={theme.warning}>Terminal Limitations</text>
      </box>

      <box paddingLeft={1}>
        {OAUTH_LIMITATION_MESSAGE.split("\n").map((line) => (
          <text fg={theme.textMuted}>{line}</text>
        ))}
      </box>

      <box height={1} />

      {/* Alternative options */}
      <text fg={theme.primary}>Recommended Alternatives:</text>

      <box flexDirection="column" gap={0} paddingLeft={2}>
        <box flexDirection="row" gap={1}>
            <text fg={theme.success}>[1]</text>
            <text fg={theme.text}>Use a sync code from the web portal</text>
            <text fg={theme.success}>[2]</text>
            <text fg={theme.text}>Use email/password authentication</text>
            <text fg={theme.success}>[3]</text>
            <text fg={theme.text}>Use file-based sync (no account needed)</text>
        </box>
      </box>

      <box height={1} />

      {/* Action buttons */}
      <box flexDirection="row" gap={2}>
        <box
          border
          padding={1}
            backgroundColor={focusField() === "code" ? theme.backgroundElement : undefined}
        >
            <text fg={focusField() === "code" ? theme.primary : undefined}>
            [C] Enter Sync Code
          </text>
        </box>

        <box
          border
          padding={1}
            backgroundColor={focusField() === "back" ? theme.backgroundElement : undefined}
        >
            <text fg={focusField() === "back" ? theme.warning : theme.textMuted}>
            [Esc] Back to Login
          </text>
        </box>
      </box>

      <box height={1} />

      <text fg={theme.textMuted}>Tab to navigate, Enter to select, Esc to go back</text>
    </box>
  );
}
