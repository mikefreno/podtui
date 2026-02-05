/**
 * Theme CSS Variable Manager
 * Handles dynamic theme switching by updating CSS custom properties
 */

export function applyTheme(theme: {
  background: string
  surface: string
  primary: string
  secondary: string
  accent: string
  text: string
  muted: string
  warning: string
  error: string
  success: string
  layerBackgrounds?: {
    layer0: string
    layer1: string
    layer2: string
    layer3: string
  }
}) {
  const root = document.documentElement

  // Apply base theme colors
  root.style.setProperty("--color-background", theme.background)
  root.style.setProperty("--color-surface", theme.surface)
  root.style.setProperty("--color-primary", theme.primary)
  root.style.setProperty("--color-secondary", theme.secondary)
  root.style.setProperty("--color-accent", theme.accent)
  root.style.setProperty("--color-text", theme.text)
  root.style.setProperty("--color-muted", theme.muted)
  root.style.setProperty("--color-warning", theme.warning)
  root.style.setProperty("--color-error", theme.error)
  root.style.setProperty("--color-success", theme.success)

  // Apply layer backgrounds if available
  if (theme.layerBackgrounds) {
    root.style.setProperty("--color-layer0", theme.layerBackgrounds.layer0)
    root.style.setProperty("--color-layer1", theme.layerBackgrounds.layer1)
    root.style.setProperty("--color-layer2", theme.layerBackgrounds.layer2)
    root.style.setProperty("--color-layer3", theme.layerBackgrounds.layer3)
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
  const root = document.documentElement
  root.setAttribute("data-theme", themeName)
}
