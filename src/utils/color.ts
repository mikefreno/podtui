/**
 * Color Resolution Utility
 * Converts CSS variable references to actual color values
 */

/**
 * Map of CSS variable names to their default color values
 * Used as fallback when CSS variables aren't resolved
 */
const CSS_VARIABLE_MAP: Record<string, string> = {
  "--color-background": "transparent",
  "--color-surface": "#1b1f27",
  "--color-primary": "#6fa8ff",
  "--color-secondary": "#a9b1d6",
  "--color-accent": "#f6c177",
  "--color-text": "#e6edf3",
  "--color-muted": "#7d8590",
  "--color-warning": "#f0b429",
  "--color-error": "#f47067",
  "--color-success": "#3fb950",
  "--color-layer0": "transparent",
  "--color-layer1": "#1e222e",
  "--color-layer2": "#161b22",
  "--color-layer3": "#0d1117",
}

/**
 * Resolves a CSS variable reference to an actual color value
 * @param variable The CSS variable string (e.g., "var(--color-primary)")
 * @returns The resolved color value or a default fallback
 */
export function resolveCSSVariable(variable: string): string {
  if (!variable || typeof variable !== "string") {
    return "#ff00ff" // Default magenta fallback
  }

  // Extract the variable name from var(--name)
  const match = variable.match(/var\(([^)]+)\)/)
  if (match && match[1]) {
    const varName = match[1].trim()
    // Get the computed style value from the document
    if (typeof document !== "undefined") {
      const root = document.documentElement
      const computedValue = getComputedStyle(root).getPropertyValue(varName)
      if (computedValue) {
        return computedValue.trim()
      }
    }
    // Fall back to the map
    return CSS_VARIABLE_MAP[varName] || "#ff00ff"
  }

  // Return the original value if it's not a CSS variable
  return variable
}

/**
 * Creates a function that resolves CSS variables from a theme object
 * @param theme The theme object with color properties
 * @returns A function that resolves CSS variable strings to actual colors
 */
export function createColorResolver(theme: {
  background?: string
  surface?: string
  primary?: string
  secondary?: string
  accent?: string
  text?: string
  muted?: string
  warning?: string
  error?: string
  success?: string
  layerBackgrounds?: {
    layer0?: string
    layer1?: string
    layer2?: string
    layer3?: string
  }
}) {
  return (color: string | undefined): string => {
    if (!color) {
      return "#ff00ff" // Default magenta fallback
    }

    // If it's already a valid hex or named color, return it
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color) || /^[a-z]+$/i.test(color)) {
      return color
    }

    // Otherwise, try to resolve it as a CSS variable
    return resolveCSSVariable(color)
  }
}
