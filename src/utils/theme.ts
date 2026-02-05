/**
 * Theme CSS Variable Manager
 * Handles dynamic theme switching by updating CSS custom properties
 */

import { RGBA, type TerminalColors } from "@opentui/core"
import type { ThemeColors } from "../types/settings"
import type { ColorValue, ThemeJson } from "../types/theme-schema"
import { THEME_JSON } from "../constants/themes"
import { getCustomThemes } from "./custom-themes"
import { resolveTheme as resolveThemeJson } from "./theme-resolver"
import { generateSystemTheme } from "./system-theme"

const toCss = (value: ColorValue | RGBA) => {
  if (value instanceof RGBA) {
    const r = Math.round(value.r * 255)
    const g = Math.round(value.g * 255)
    const b = Math.round(value.b * 255)
    return `rgba(${r}, ${g}, ${b}, ${value.a})`
  }
  if (typeof value === "number") return `var(--ansi-${value})`
  if (typeof value === "string") return value
  return value.dark
}

export function applyTheme(theme: ThemeColors | Record<string, RGBA>) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.style.setProperty("--color-background", toCss(theme.background as ColorValue))
  root.style.setProperty("--color-surface", toCss(theme.surface as ColorValue))
  root.style.setProperty("--color-primary", toCss(theme.primary as ColorValue))
  root.style.setProperty("--color-secondary", toCss(theme.secondary as ColorValue))
  root.style.setProperty("--color-accent", toCss(theme.accent as ColorValue))
  root.style.setProperty("--color-text", toCss(theme.text as ColorValue))
  root.style.setProperty("--color-muted", toCss(theme.muted as ColorValue))
  root.style.setProperty("--color-warning", toCss(theme.warning as ColorValue))
  root.style.setProperty("--color-error", toCss(theme.error as ColorValue))
  root.style.setProperty("--color-success", toCss(theme.success as ColorValue))

  const layers = theme.layerBackgrounds as Record<string, ColorValue> | undefined
  if (layers) {
    root.style.setProperty("--color-layer0", toCss(layers.layer0))
    root.style.setProperty("--color-layer1", toCss(layers.layer1))
    root.style.setProperty("--color-layer2", toCss(layers.layer2))
    root.style.setProperty("--color-layer3", toCss(layers.layer3))
  }
}

/**
 * Get theme mode from system preference
 */
export function getSystemThemeMode(): "dark" | "light" {
  if (typeof window === "undefined") return "dark"

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  return prefersDark ? "dark" : "light"
}

/**
 * Apply CSS variable data-theme attribute
 */
export function setThemeAttribute(themeName: string) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.setAttribute("data-theme", themeName)
}

export async function loadThemes() {
  return await getCustomThemes()
}

export async function loadTheme(name: string) {
  const themes = await loadThemes()
  return themes[name]
}

export function resolveTheme(theme: ThemeJson, mode: "dark" | "light") {
  return resolveThemeJson(theme, mode)
}

export function resolveTerminalTheme(
  themes: Record<string, ThemeJson>,
  name: string,
  mode: "dark" | "light",
  system?: TerminalColors
) {
  if (name === "system" && system) {
    return resolveThemeJson(generateSystemTheme(system, mode), mode)
  }
  const theme = themes[name] ?? themes.opencode
  if (!theme) {
    return resolveThemeJson(THEME_JSON.opencode, mode)
  }
  return resolveThemeJson(theme, mode)
}
