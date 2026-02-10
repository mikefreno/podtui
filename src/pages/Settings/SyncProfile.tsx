/**
 * Sync profile component for PodTUI
 * Displays user profile information and sync status
 */

import { createSignal } from "solid-js";
import { useAuthStore } from "@/stores/auth";
import { format } from "date-fns";
import { useTheme } from "@/context/ThemeContext";

interface SyncProfileProps {
  focused?: boolean;
  onLogout?: () => void;
  onManageSync?: () => void;
}

type FocusField = "sync" | "export" | "logout";

export function SyncProfile(props: SyncProfileProps) {
  const auth = useAuthStore();
  const { theme } = useTheme();
  const [focusField, setFocusField] = createSignal<FocusField>("sync");
  const [lastSyncTime] = createSignal<Date | null>(new Date());

  const fields: FocusField[] = ["sync", "export", "logout"];

  const handleKeyPress = (key: { name: string; shift?: boolean }) => {
    if (key.name === "tab") {
      const currentIndex = fields.indexOf(focusField());
      const nextIndex = key.shift
        ? (currentIndex - 1 + fields.length) % fields.length
        : (currentIndex + 1) % fields.length;
      setFocusField(fields[nextIndex]);
    } else if (key.name === "return") {
      if (focusField() === "sync" && props.onManageSync) {
        props.onManageSync();
      } else if (focusField() === "logout" && props.onLogout) {
        handleLogout();
      }
    }
  };

  const handleLogout = () => {
    auth.logout();
    if (props.onLogout) {
      props.onLogout();
    }
  };

  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return "Never";
    return format(date, "MMM d, yyyy HH:mm");
  };

  const user = () => auth.state().user;

  // Get user initials for avatar
  const userInitials = () => {
    const name = user()?.name || "?";
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <box flexDirection="column" border padding={2} gap={1} borderColor={theme.border}>
      <text fg={theme.text}>
        <strong>User Profile</strong>
      </text>

      <box height={1} />

      {/* User avatar and info */}
      <box flexDirection="row" gap={2}>
        {/* ASCII avatar */}
        <box
          border
          padding={1}
          width={8}
          height={4}
          justifyContent="center"
          alignItems="center"
        >
          <text fg={theme.primary}>{userInitials()}</text>
        </box>

        {/* User details */}
        <box flexDirection="column" gap={0}>
            <text fg={theme.text}>{user()?.name || "Guest User"}</text>
            <text fg={theme.textMuted}>{user()?.email || "No email"}</text>
            <text fg={theme.textMuted}>Joined: {formatDate(user()?.createdAt)}</text>
        </box>
      </box>

      <box height={1} />

      {/* Sync status section */}
      <box border padding={1} flexDirection="column" gap={0} borderColor={theme.border}>
        <text fg={theme.primary}>Sync Status</text>

        <box flexDirection="row" gap={1}>
            <text fg={theme.textMuted}>Status:</text>
            <text fg={user()?.syncEnabled ? theme.success : theme.warning}>
              {user()?.syncEnabled ? "Enabled" : "Disabled"}
            </text>
        </box>

        <box flexDirection="row" gap={1}>
            <text fg={theme.textMuted}>Last Sync:</text>
            <text fg={theme.text}>{formatDate(lastSyncTime())}</text>
        </box>

        <box flexDirection="row" gap={1}>
            <text fg={theme.textMuted}>Method:</text>
            <text fg={theme.text}>File-based (JSON/XML)</text>
        </box>
      </box>

      <box height={1} />

      {/* Action buttons */}
      <box flexDirection="row" gap={2}>
        <box
          border
          padding={1}
            backgroundColor={focusField() === "sync" ? theme.backgroundElement : undefined}
        >
            <text fg={focusField() === "sync" ? theme.primary : undefined}>
            [S] Manage Sync
          </text>
        </box>

        <box
          border
          padding={1}
            backgroundColor={focusField() === "export" ? theme.backgroundElement : undefined}
        >
            <text fg={focusField() === "export" ? theme.primary : undefined}>
            [E] Export Data
          </text>
        </box>

        <box
          border
          padding={1}
            backgroundColor={focusField() === "logout" ? theme.backgroundElement : undefined}
        >
            <text fg={focusField() === "logout" ? theme.error : theme.textMuted}>
            [L] Logout
          </text>
        </box>
      </box>

      <box height={1} />

      <text fg={theme.textMuted}>Tab to navigate, Enter to select</text>
    </box>
  );
}
