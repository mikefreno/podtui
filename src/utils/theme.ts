/**
 * Terminal Theme Resolver
 * Resolves the active theme (built-in, custom, or system-derived) to colors.
 */

import type { TerminalColors } from "@opentui/core";
import type { ThemeJson } from "../types/theme-schema";
import { resolveTheme as resolveThemeJson } from "./theme-resolver";
import { generateSystemTheme } from "./system-theme";

export function resolveTerminalTheme(
  themes: Record<string, ThemeJson>,
  name: string,
  mode: "dark" | "light",
  system?: TerminalColors,
) {
  if (name === "system" && system) {
    return resolveThemeJson(generateSystemTheme(system, mode), mode);
  }
  return resolveThemeJson(themes[name] ?? themes.catppuccin, mode);
}
