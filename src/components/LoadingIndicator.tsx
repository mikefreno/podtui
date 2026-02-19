/**
 * Loading indicator component
 * Displays an animated sliding bar at the top of the screen
 */

import { For } from "solid-js";
import { useTheme } from "@/context/ThemeContext";

interface LoadingIndicatorProps {
  isLoading: boolean;
}

export function LoadingIndicator(props: LoadingIndicatorProps) {
  const { theme } = useTheme();

  if (!props.isLoading) return null;

  return (
    <box
      flexDirection="row"
      width="100%"
      height={1}
      backgroundColor={theme.background}
    >
      <For each={Array.from({ length: 10 })}>
        {(_, index) => (
          <box
            width={2}
            backgroundColor={theme.primary}
            style={{ opacity: 0.1 + index() * 0.1 }}
          />
        )}
      </For>
    </box>
  );
}
