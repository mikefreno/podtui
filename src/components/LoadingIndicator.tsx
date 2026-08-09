import { createSignal, createMemo, onCleanup } from "solid-js";
import { useTheme } from "@/context/ThemeContext";

const spinnerChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function LoadingIndicator() {
  const { theme } = useTheme();
  const [index, setIndex] = createSignal(0);

  const interval = setInterval(() => {
    setIndex((i) => (i + 1) % spinnerChars.length);
  }, 65);

  onCleanup(() => clearInterval(interval));

  const currentChar = createMemo(() => spinnerChars[index()]);

  return (
    <box flexDirection="row" justifyContent="flex-end" alignItems="flex-start">
      <text fg={theme.primary} content={currentChar()} />
    </box>
  );
}
