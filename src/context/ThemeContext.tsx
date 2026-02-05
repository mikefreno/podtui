import { createContext, useContext, createSignal, createEffect, onCleanup } from "solid-js"
import type { ThemeColors, ThemeName } from "../types/settings"
import { useAppStore } from "../stores/app"
import { applyTheme, setThemeAttribute, getSystemThemeMode } from "../utils/theme"

type ThemeContextType = {
  themeName: () => ThemeName
  setThemeName: (theme: ThemeName) => void
  resolvedTheme: () => ThemeColors
  isSystemTheme: () => boolean
  currentMode: () => "dark" | "light"
}

const ThemeContext = createContext<ThemeContextType>()

export function ThemeProvider({ children }: { children: any }) {
  const appStore = useAppStore()
  const [themeName, setThemeName] = createSignal<ThemeName>(appStore.state().settings.theme)
  const [resolvedTheme, setResolvedTheme] = createSignal<ThemeColors>(appStore.resolveTheme())
  const [currentMode, setCurrentMode] = createSignal<"dark" | "light">(getSystemThemeMode())

  const isSystemTheme = () => themeName() === "system"

  // Update theme when appStore theme changes
  createEffect(() => {
    const currentTheme = appStore.state().settings.theme
    setThemeName(currentTheme)
    setResolvedTheme(appStore.resolveTheme())

    // Apply theme to CSS variables
    if (currentTheme === "system") {
      const mode = getSystemThemeMode()
      setCurrentMode(mode)
      applyTheme(resolvedTheme())
    } else {
      setCurrentMode("dark") // All themes are dark by default
    }

    setThemeAttribute(currentTheme === "system" ? "system" : currentTheme)
  })

  // Handle system theme changes
  createEffect(() => {
    if (isSystemTheme()) {
      // Check if window and matchMedia are available
      if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
        const handler = () => {
          const newMode = getSystemThemeMode()
          setCurrentMode(newMode)
          setResolvedTheme(appStore.resolveTheme())
        }

        mediaQuery.addEventListener("change", handler)

        onCleanup(() => {
          mediaQuery.removeEventListener("change", handler)
        })
      }
    }
  })

  return (
    <ThemeContext.Provider value={{ themeName, setThemeName, resolvedTheme, isSystemTheme, currentMode }}>
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
