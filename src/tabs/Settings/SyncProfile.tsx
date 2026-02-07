/**
 * Sync profile component for PodTUI
 * Displays user profile information and sync status
 */

import { createSignal } from "solid-js";
import { useAuthStore } from "@/stores/auth";
import { format } from "date-fns";

interface SyncProfileProps {
  focused?: boolean;
  onLogout?: () => void;
  onManageSync?: () => void;
}

type FocusField = "sync" | "export" | "logout";

export function SyncProfile(props: SyncProfileProps) {
  const auth = useAuthStore();
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
    <box flexDirection="column" border padding={2} gap={1}>
      <text>
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
          <text fg="cyan">{userInitials()}</text>
        </box>

        {/* User details */}
        <box flexDirection="column" gap={0}>
          <text fg="white">{user()?.name || "Guest User"}</text>
          <text fg="gray">{user()?.email || "No email"}</text>
          <text fg="gray">Joined: {formatDate(user()?.createdAt)}</text>
        </box>
      </box>

      <box height={1} />

      {/* Sync status section */}
      <box border padding={1} flexDirection="column" gap={0}>
        <text fg="cyan">Sync Status</text>

        <box flexDirection="row" gap={1}>
          <text fg="gray">Status:</text>
          <text fg={user()?.syncEnabled ? "green" : "yellow"}>
            {user()?.syncEnabled ? "Enabled" : "Disabled"}
          </text>
        </box>

        <box flexDirection="row" gap={1}>
          <text fg="gray">Last Sync:</text>
          <text fg="white">{formatDate(lastSyncTime())}</text>
        </box>

        <box flexDirection="row" gap={1}>
          <text fg="gray">Method:</text>
          <text fg="white">File-based (JSON/XML)</text>
        </box>
      </box>

      <box height={1} />

      {/* Action buttons */}
      <box flexDirection="row" gap={2}>
        <box
          border
          padding={1}
          backgroundColor={focusField() === "sync" ? "#333" : undefined}
        >
          <text fg={focusField() === "sync" ? "cyan" : undefined}>
            [S] Manage Sync
          </text>
        </box>

        <box
          border
          padding={1}
          backgroundColor={focusField() === "export" ? "#333" : undefined}
        >
          <text fg={focusField() === "export" ? "cyan" : undefined}>
            [E] Export Data
          </text>
        </box>

        <box
          border
          padding={1}
          backgroundColor={focusField() === "logout" ? "#333" : undefined}
        >
          <text fg={focusField() === "logout" ? "red" : "gray"}>
            [L] Logout
          </text>
        </box>
      </box>

      <box height={1} />

      <text fg="gray">Tab to navigate, Enter to select</text>
    </box>
  );
}
