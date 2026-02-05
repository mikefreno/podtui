import type { ThemeColors, ThemeDefinition, ThemeName } from "../types/settings"
import { BASE_THEME_COLORS, BASE_LAYER_BACKGROUND } from "../types/desktop-theme"
import catppuccin from "../themes/catppuccin.json" with { type: "json" }
import gruvbox from "../themes/gruvbox.json" with { type: "json" }
import tokyo from "../themes/tokyo.json" with { type: "json" }
import nord from "../themes/nord.json" with { type: "json" }
import opencode from "../themes/opencode.json" with { type: "json" }

export const DEFAULT_THEME: ThemeColors = {
  ...BASE_THEME_COLORS,
  layerBackgrounds: BASE_LAYER_BACKGROUND,
}

export const THEME_JSON: Record<string, ThemeDefinition> = {
  opencode: opencode as ThemeDefinition,
  catppuccin: catppuccin as ThemeDefinition,
  gruvbox: gruvbox as ThemeDefinition,
  tokyo: tokyo as ThemeDefinition,
  nord: nord as ThemeDefinition,
}
