/**
 * Theme CSS Variable Manager
 * Handles dynamic theme switching by updating CSS custom properties
 */

import type { TerminalColors } from "@opentui/core";
import type { ThemeJson } from "../types/theme-schema";
import { THEME_JSON } from "../constants/themes";
import { getCustomThemes } from "./custom-themes";
import { resolveTheme as resolveThemeJson } from "./theme-resolver";
import { generateSystemTheme } from "./system-theme";

/**
 * Apply CSS variable data-theme attribute
 */
export function setThemeAttribute(themeName: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", themeName);
}

export async function loadThemes() {
  return await getCustomThemes();
}

export function resolveTerminalTheme(
  themes: Record<string, ThemeJson>,
  name: string,
  mode: "dark" | "light",
  system?: TerminalColors,
) {
  if (name === "system" && system) {
    return resolveThemeJson(generateSystemTheme(system, mode), mode);
  }
  const theme = themes[name] ?? themes.catppuccin;
  if (!theme) {
    return resolveThemeJson(THEME_JSON.catppuccin, mode);
  }
  return resolveThemeJson(theme, mode);
}
