/**
 * Login screen component for PodTUI
 * Email/password login with links to code validation and OAuth
 */

import { createSignal } from "solid-js";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/context/ThemeContext";
import { AUTH_CONFIG } from "@/config/auth";

interface LoginScreenProps {
  focused?: boolean;
  onNavigateToCode?: () => void;
  onNavigateToOAuth?: () => void;
}

type FocusField = "email" | "password" | "submit" | "code" | "oauth";

export function LoginScreen(props: LoginScreenProps) {
  const auth = useAuthStore();
  const { theme } = useTheme();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [focusField, setFocusField] = createSignal<FocusField>("email");
  const [emailError, setEmailError] = createSignal<string | null>(null);
  const [passwordError, setPasswordError] = createSignal<string | null>(null);

  const fields: FocusField[] = ["email", "password", "submit", "code", "oauth"];

  const validateEmail = (value: string): boolean => {
    if (!value) {
      setEmailError("Email is required");
      return false;
    }
    if (!AUTH_CONFIG.email.pattern.test(value)) {
      setEmailError("Invalid email format");
      return false;
    }
    setEmailError(null);
    return true;
  };

  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError("Password is required");
      return false;
    }
    if (value.length < AUTH_CONFIG.password.minLength) {
      setPasswordError(`Minimum ${AUTH_CONFIG.password.minLength} characters`);
      return false;
    }
    setPasswordError(null);
    return true;
  };

  const handleSubmit = async () => {
    const isEmailValid = validateEmail(email());
    const isPasswordValid = validatePassword(password());

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    await auth.login({ email: email(), password: password() });
  };

  const handleKeyPress = (key: { name: string; shift?: boolean }) => {
    if (key.name === "tab") {
      const currentIndex = fields.indexOf(focusField());
      const nextIndex = key.shift
        ? (currentIndex - 1 + fields.length) % fields.length
        : (currentIndex + 1) % fields.length;
      setFocusField(fields[nextIndex]);
    } else if (key.name === "return" || key.name === "enter") {
      if (focusField() === "submit") {
        handleSubmit();
      } else if (focusField() === "code" && props.onNavigateToCode) {
        props.onNavigateToCode();
      } else if (focusField() === "oauth" && props.onNavigateToOAuth) {
        props.onNavigateToOAuth();
      }
    }
  };

  return (
    <box flexDirection="column" border padding={2} gap={1}>
      <text>
        <strong>Sign In</strong>
      </text>

      <box height={1} />

      {/* Email field */}
      <box flexDirection="column" gap={0}>
        <text fg={focusField() === "email" ? theme.primary : undefined}>
          Email:
        </text>
        <input
          value={email()}
          onInput={setEmail}
          placeholder="your@email.com"
          focused={props.focused && focusField() === "email"}
          width={30}
        />
        {emailError() && <text fg={theme.error}>{emailError()}</text>}
      </box>

      {/* Password field */}
      <box flexDirection="column" gap={0}>
        <text fg={focusField() === "password" ? theme.primary : undefined}>
          Password:
        </text>
        <input
          value={password()}
          onInput={setPassword}
          placeholder="********"
          focused={props.focused && focusField() === "password"}
          width={30}
        />
        {passwordError() && <text fg={theme.error}>{passwordError()}</text>}
      </box>

      <box height={1} />

      {/* Submit button */}
      <box flexDirection="row" gap={2}>
        <box
          border
          padding={1}
          backgroundColor={
            focusField() === "submit" ? theme.primary : undefined
          }
        >
          <text fg={focusField() === "submit" ? theme.text : undefined}>
            {auth.isLoading ? "Signing in..." : "[Enter] Sign In"}
          </text>
        </box>
      </box>

      {/* Auth error message */}
      {auth.error && <text fg={theme.error}>{auth.error.message}</text>}

      <box height={1} />

      {/* Alternative auth options */}
      <text fg={theme.textMuted}>Or authenticate with:</text>

      <box flexDirection="row" gap={2}>
        <box
          border
          padding={1}
          backgroundColor={focusField() === "code" ? theme.primary : undefined}
        >
          <text fg={focusField() === "code" ? theme.accent : theme.textMuted}>
            [C] Sync Code
          </text>
        </box>

        <box
          border
          padding={1}
          backgroundColor={focusField() === "oauth" ? theme.primary : undefined}
        >
          <text fg={focusField() === "oauth" ? theme.accent : theme.textMuted}>
            [O] OAuth Info
          </text>
        </box>
      </box>

      <box height={1} />

      <text fg={theme.textMuted}>Tab to navigate, Enter to select</text>
    </box>
  );
}
