import { useTheme } from "@/context/ThemeContext";
import { children as solidChildren } from "solid-js";
import type { ParentComponent } from "solid-js";
import type { BoxOptions, TextOptions } from "@opentui/core";

export const SelectableBox: ParentComponent<
  {
    selected: () => boolean;
  } & BoxOptions
> = (props) => {
  const themeContext = useTheme();
  const { theme } = themeContext;

  const child = solidChildren(() => props.children);

  return (
    <box
      border={!!props.border}
      borderColor={props.selected() ? theme.surface : theme.border}
      backgroundColor={
        props.selected()
          ? theme.primary
          : themeContext.transparentBackground() ||
              themeContext.selected === "system"
            ? "transparent"
            : themeContext.theme.surface
      }
      {...props}
    >
      {child()}
    </box>
  );
};

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

export const SelectableText: ParentComponent<
  {
    selected: () => boolean;
    primary?: boolean;
    secondary?: boolean;
    tertiary?: boolean;
  } & TextOptions
> = (props) => {
  const child = solidChildren(() => props.children);

  return (
    <text
      fg={getTextColor(
        props.primary
          ? ColorSet.PRIMARY
          : props.secondary
            ? ColorSet.SECONDARY
            : props.tertiary
              ? ColorSet.TERTIARY
              : ColorSet.DEFAULT,
        props.selected,
      )}
      {...props}
    >
      {child()}
    </text>
  );
};
