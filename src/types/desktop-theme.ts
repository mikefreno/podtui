import type {
  DesktopTheme,
  ThemeColors,
  ThemeName,
  ThemeToken,
  ThemeVariant,
} from "../types/settings"

// Base theme colors
export const BASE_THEME_COLORS: ThemeColors = {
  background: "transparent",
  surface: "#1b1f27",
  primary: "#6fa8ff",
  secondary: "#a9b1d6",
  accent: "#f6c177",
  text: "#e6edf3",
  muted: "#7d8590",
  warning: "#f0b429",
  error: "#f47067",
  success: "#3fb950",
}

// Base layer backgrounds
export const BASE_LAYER_BACKGROUND: ThemeColors["layerBackgrounds"] = {
  layer0: "transparent",
  layer1: "#1e222e",
  layer2: "#161b22",
  layer3: "#0d1117",
}

// Theme tokens
export const BASE_THEME_TOKENS: ThemeToken = {
  "background": "transparent",
  "surface": "#1b1f27",
  "primary": "#6fa8ff",
  "secondary": "#a9b1d6",
  "accent": "#f6c177",
  "text": "#e6edf3",
  "muted": "#7d8590",
  "warning": "#f0b429",
  "error": "#f47067",
  "success": "#3fb950",
  "layer0": "transparent",
  "layer1": "#1e222e",
  "layer2": "#161b22",
  "layer3": "#0d1117",
}

// Desktop theme structure
export const THEMES_DESKTOP: DesktopTheme = {
  name: "PodTUI",
  variants: [
    {
      name: "catppuccin",
      colors: {
        background: "transparent",
        surface: "#1e1e2e",
        primary: "#89b4fa",
        secondary: "#cba6f7",
        accent: "#f9e2af",
        text: "#cdd6f4",
        muted: "#7f849c",
        warning: "#fab387",
        error: "#f38ba8",
        success: "#a6e3a1",
        layerBackgrounds: {
          layer0: "transparent",
          layer1: "#181825",
          layer2: "#11111b",
          layer3: "#0a0a0f",
        },
      },
    },
    {
      name: "gruvbox",
      colors: {
        background: "transparent",
        surface: "#282828",
        primary: "#fabd2f",
        secondary: "#83a598",
        accent: "#fe8019",
        text: "#ebdbb2",
        muted: "#928374",
        warning: "#fabd2f",
        error: "#fb4934",
        success: "#b8bb26",
        layerBackgrounds: {
          layer0: "transparent",
          layer1: "#32302a",
          layer2: "#1d2021",
          layer3: "#0d0c0c",
        },
      },
    },
    {
      name: "tokyo",
      colors: {
        background: "transparent",
        surface: "#1a1b26",
        primary: "#7aa2f7",
        secondary: "#bb9af7",
        accent: "#e0af68",
        text: "#c0caf5",
        muted: "#565f89",
        warning: "#e0af68",
        error: "#f7768e",
        success: "#9ece6a",
        layerBackgrounds: {
          layer0: "transparent",
          layer1: "#16161e",
          layer2: "#0f0f15",
          layer3: "#08080b",
        },
      },
    },
    {
      name: "nord",
      colors: {
        background: "transparent",
        surface: "#2e3440",
        primary: "#88c0d0",
        secondary: "#81a1c1",
        accent: "#ebcb8b",
        text: "#eceff4",
        muted: "#4c566a",
        warning: "#ebcb8b",
        error: "#bf616a",
        success: "#a3be8c",
        layerBackgrounds: {
          layer0: "transparent",
          layer1: "#3b4252",
          layer2: "#242933",
          layer3: "#1a1c23",
        },
      },
    },
  ],
  defaultVariant: "catppuccin",
  tokens: BASE_THEME_TOKENS,
}

// Helper function to get theme by name
export function getThemeByName(name: ThemeName): ThemeVariant | undefined {
  return THEMES_DESKTOP.variants.find((variant) => variant.name === name)
}

// Helper function to get default theme
export function getDefaultTheme(): ThemeVariant {
  return THEMES_DESKTOP.variants.find(
    (variant) => variant.name === THEMES_DESKTOP.defaultVariant
  )!
}
