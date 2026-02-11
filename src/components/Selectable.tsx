import { useTheme } from "@/context/ThemeContext";
import type { JSXElement } from "solid-js";
import type { BoxOptions, TextOptions } from "@opentui/core";

export function SelectableBox({
  selected,
  children,
  ...props
}: {
  selected: () => boolean;
  children: JSXElement;
} & BoxOptions) {
  const { theme } = useTheme();

  return (
    <box
      borderColor={selected() ? theme.surface : theme.border}
      backgroundColor={selected() ? theme.primary : theme.surface}
      {...props}
    >
      {children}
    </box>
  );
}

export function SelectableText({
  selected,
  children,
  ...props
}: {
  selected: () => boolean;
  children: JSXElement;
} & TextOptions) {
  const { theme } = useTheme();

  return (
    <text fg={selected() ? theme.surface : theme.text} {...props}>
      {children}
    </text>
  );
}
