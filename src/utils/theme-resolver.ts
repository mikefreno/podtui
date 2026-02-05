import { RGBA } from "@opentui/core"
import type { ColorValue, ThemeJson } from "../types/theme-schema"
import { ansiToRgba } from "./ansi-to-rgba"

export type ThemeMode = "dark" | "light"

export function resolveTheme(theme: ThemeJson, mode: ThemeMode) {
  const defs = theme.defs ?? {}

  function resolveColor(value: ColorValue): RGBA {
    if (value instanceof RGBA) return value
    if (typeof value === "number") return ansiToRgba(value)
    if (typeof value === "string") {
      if (value === "transparent" || value === "none") return RGBA.fromInts(0, 0, 0, 0)
      if (value.startsWith("#")) return RGBA.fromHex(value)
      if (defs[value] != null) return resolveColor(defs[value])
      const ref = theme.theme[value]
      if (ref != null) return resolveColor(ref)
      throw new Error(`Color reference "${value}" not found in defs or theme`)
    }
    return resolveColor(value[mode])
  }

  const resolved = Object.fromEntries(
    Object.entries(theme.theme)
      .filter(([key]) => key !== "selectedListItemText" && key !== "backgroundMenu" && key !== "thinkingOpacity")
      .map(([key, value]) => [key, resolveColor(value)])
  ) as Record<string, RGBA>

  const hasSelected = theme.theme.selectedListItemText !== undefined
  resolved.selectedListItemText = hasSelected
    ? resolveColor(theme.theme.selectedListItemText!)
    : resolved.background

  resolved.backgroundMenu = theme.theme.backgroundMenu
    ? resolveColor(theme.theme.backgroundMenu)
    : resolved.backgroundElement

  const thinkingOpacity = theme.theme.thinkingOpacity ?? 0.6

  return {
    ...resolved,
    _hasSelectedListItemText: hasSelected,
    thinkingOpacity,
  }
}
