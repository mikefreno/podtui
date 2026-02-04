import { createContext, useContext, createSignal } from "solid-js"
import type { ThemeColors, ThemeName } from "../types/settings"

type ThemeContextType = {
  themeName: () => ThemeName
  setThemeName: (theme: ThemeName) => void
  resolvedTheme: ThemeColors
  isSystemTheme: () => boolean
}

const ThemeContext = createContext<ThemeContextType>()

export function ThemeProvider({ children }: { children: any }) {
  const [themeName, setThemeName] = createSignal<ThemeName>("system")

  const isSystemTheme = () => themeName() === "system"

  const resolvedTheme = {
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
    layerBackgrounds: {
      layer0: "transparent",
      layer1: "#1e222e",
      layer2: "#161b22",
      layer3: "#0d1117",
    },
  }

  return (
    <ThemeContext.Provider value={{ themeName, setThemeName, resolvedTheme, isSystemTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
