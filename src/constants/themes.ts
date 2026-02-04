import type { ThemeColors, ThemeName } from "../types/settings"
import { BASE_THEME_COLORS, BASE_LAYER_BACKGROUND, THEMES_DESKTOP } from "../types/desktop-theme"

export const DEFAULT_THEME: ThemeColors = {
  ...BASE_THEME_COLORS,
  layerBackgrounds: BASE_LAYER_BACKGROUND,
}

export const THEMES: Record<ThemeName, ThemeColors> = {
  system: DEFAULT_THEME,
  catppuccin: THEMES_DESKTOP.variants.find((v) => v.name === "catppuccin")!.colors,
  gruvbox: THEMES_DESKTOP.variants.find((v) => v.name === "gruvbox")!.colors,
  tokyo: THEMES_DESKTOP.variants.find((v) => v.name === "tokyo")!.colors,
  nord: THEMES_DESKTOP.variants.find((v) => v.name === "nord")!.colors,
  custom: DEFAULT_THEME,
}
