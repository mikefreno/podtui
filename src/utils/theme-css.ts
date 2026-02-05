import { RGBA } from "@opentui/core"
import type { ColorValue } from "../types/theme-schema"

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

export function applyThemeToCSS(theme: Record<string, RGBA | ColorValue>) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme)) {
    if (key === "layerBackgrounds" && typeof value === "object") {
      const layers = value as Record<string, RGBA | ColorValue>
      for (const [layer, color] of Object.entries(layers)) {
        root.style.setProperty(`--color-${layer}`, toCss(color))
      }
    } else {
      root.style.setProperty(`--color-${key}`, toCss(value as ColorValue | RGBA))
    }
  }
}

export function setThemeAttribute(themeName: string) {
  document.documentElement.setAttribute("data-theme", themeName)
}

export function resolveColorReference(value: ColorValue) {
  return toCss(value)
}
