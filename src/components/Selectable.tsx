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
      border={!!props.border}
      borderColor={selected() ? theme.surface : theme.border}
      backgroundColor={selected() ? theme.primary : theme.surface}
      {...props}
    >
      {children}
    </box>
  );
}

enum ColorSet {
  PRIMARY,
  SECONDARY,
  TERTIARY,
  DEFAULT,
}
function getTextColor(set: ColorSet, selected: () => boolean) {
  const { theme } = useTheme();
  switch (set) {
    case ColorSet.PRIMARY:
      return selected() ? theme.textSelectedPrimary : theme.textPrimary;
    case ColorSet.SECONDARY:
      return selected() ? theme.textSelectedSecondary : theme.textSecondary;
    case ColorSet.TERTIARY:
      return selected() ? theme.textSelectedTertiary : theme.textTertiary;
    default:
      return theme.textPrimary;
  }
}

export function SelectableText({
  selected,
  children,
  primary,
  secondary,
  tertiary,
  ...props
}: {
  selected: () => boolean;
  primary?: boolean;
  secondary?: boolean;
  tertiary?: boolean;
  children: JSXElement;
} & TextOptions) {
  return (
    <text
      fg={getTextColor(
        primary
          ? ColorSet.PRIMARY
          : secondary
            ? ColorSet.SECONDARY
            : tertiary
              ? ColorSet.TERTIARY
              : ColorSet.DEFAULT,
        selected,
      )}
      {...props}
    >
      {children}
    </text>
  );
}
