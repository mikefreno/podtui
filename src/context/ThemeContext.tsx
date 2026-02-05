import { createContext, createEffect, createMemo, createSignal, useContext } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { useRenderer } from "@opentui/solid"
import type { ThemeName } from "../types/settings"
import type { ThemeJson } from "../types/theme-schema"
import { useAppStore } from "../stores/app"
import { THEME_JSON } from "../constants/themes"
import { resolveTheme } from "../utils/theme-resolver"
import { generateSyntax, generateSubtleSyntax } from "../utils/syntax-highlighter"
import { generateSystemTheme } from "../utils/system-theme"
import { getCustomThemes } from "../utils/custom-themes"
import { setThemeAttribute } from "../utils/theme"
import type { RGBA } from "@opentui/core"

type ThemeContextValue = {
  theme: Record<string, unknown>
  selected: () => string
  all: () => Record<string, ThemeJson>
  syntax: () => unknown
  subtleSyntax: () => unknown
  mode: () => "dark" | "light"
  setMode: (mode: "dark" | "light") => void
  set: (theme: string) => void
  ready: () => boolean
}

const ThemeContext = createContext<ThemeContextValue>()

export function ThemeProvider({ children }: { children: any }) {
  const appStore = useAppStore()
  const renderer = useRenderer()
  const [ready, setReady] = createSignal(false)
  const [store, setStore] = createStore({
    themes: { ...THEME_JSON } as Record<string, ThemeJson>,
    mode: "dark" as "dark" | "light",
    active: appStore.state().settings.theme as ThemeName,
  })

  const init = () => {
    getCustomThemes()
      .then((custom) => {
        setStore(
          produce((draft) => {
            Object.assign(draft.themes, custom)
          })
        )
      })
      .finally(() => setReady(true))
  }

  init()

  createEffect(() => {
    setStore("active", appStore.state().settings.theme)
    setThemeAttribute(appStore.state().settings.theme)
  })

  createEffect(() => {
    if (store.active !== "system") return
    renderer
      .getPalette({ size: 16 })
      .then((colors) => {
        setStore(
          produce((draft) => {
            draft.themes.system = generateSystemTheme(colors, store.mode)
          })
        )
      })
      .catch(() => {})
  })

  const values = createMemo(() => {
    const theme = store.themes[store.active] ?? store.themes.opencode
    return resolveTheme(theme, store.mode)
  })

  const syntax = createMemo(() => generateSyntax(values() as unknown as Record<string, RGBA>))
  const subtleSyntax = createMemo(() =>
    generateSubtleSyntax(values() as unknown as Record<string, RGBA> & { thinkingOpacity?: number })
  )

  const context: ThemeContextValue = {
    theme: new Proxy(values(), {
      get(_target, prop) {
        return values()[prop as keyof typeof values]
      },
    }),
    selected: () => store.active,
    all: () => store.themes,
    syntax,
    subtleSyntax,
    mode: () => store.mode,
    setMode: (mode) => setStore("mode", mode),
    set: (theme) => appStore.setTheme(theme as ThemeName),
    ready,
  }

  return <ThemeContext.Provider value={context}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
