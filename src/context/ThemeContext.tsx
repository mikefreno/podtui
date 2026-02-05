import { createContext, createEffect, createMemo, createSignal, Show, useContext } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { useRenderer } from "@opentui/solid"
import type { ThemeName } from "../types/settings"
import type { ThemeJson } from "../types/theme-schema"
import { useAppStore } from "../stores/app"
import { THEME_JSON } from "../constants/themes"
import { resolveTheme } from "../utils/theme-resolver"
import { generateSyntax, generateSubtleSyntax } from "../utils/syntax-highlighter"
import { resolveTerminalTheme, loadThemes } from "../utils/theme"
import type { RGBA, TerminalColors } from "@opentui/core"

type ThemeResolved = {
  primary: RGBA
  secondary: RGBA
  accent: RGBA
  error: RGBA
  warning: RGBA
  success: RGBA
  info: RGBA
  text: RGBA
  textMuted: RGBA
  selectedListItemText: RGBA
  background: RGBA
  backgroundPanel: RGBA
  backgroundElement: RGBA
  backgroundMenu: RGBA
  border: RGBA
  borderActive: RGBA
  borderSubtle: RGBA
  diffAdded: RGBA
  diffRemoved: RGBA
  diffContext: RGBA
  diffHunkHeader: RGBA
  diffHighlightAdded: RGBA
  diffHighlightRemoved: RGBA
  diffAddedBg: RGBA
  diffRemovedBg: RGBA
  diffContextBg: RGBA
  diffLineNumber: RGBA
  diffAddedLineNumberBg: RGBA
  diffRemovedLineNumberBg: RGBA
  markdownText: RGBA
  markdownHeading: RGBA
  markdownLink: RGBA
  markdownLinkText: RGBA
  markdownCode: RGBA
  markdownBlockQuote: RGBA
  markdownEmph: RGBA
  markdownStrong: RGBA
  markdownHorizontalRule: RGBA
  markdownListItem: RGBA
  markdownListEnumeration: RGBA
  markdownImage: RGBA
  markdownImageText: RGBA
  markdownCodeBlock: RGBA
  syntaxComment: RGBA
  syntaxKeyword: RGBA
  syntaxFunction: RGBA
  syntaxVariable: RGBA
  syntaxString: RGBA
  syntaxNumber: RGBA
  syntaxType: RGBA
  syntaxOperator: RGBA
  syntaxPunctuation: RGBA
  muted?: RGBA
  surface?: RGBA
  layerBackgrounds?: {
    layer0: RGBA
    layer1: RGBA
    layer2: RGBA
    layer3: RGBA
  }
  _hasSelectedListItemText?: boolean
  thinkingOpacity?: number
}

type ThemeContextValue = {
  theme: ThemeResolved
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
    themes: {} as Record<string, ThemeJson>,
    mode: "dark" as "dark" | "light",
    active: appStore.state().settings.theme as ThemeName,
    system: undefined as undefined | TerminalColors,
  })

  const init = () => {
    loadThemes()
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
  })

  createEffect(() => {
    renderer
      .getPalette({ size: 16 })
      .then((colors) => setStore("system", colors))
      .catch(() => {})
  })

  const values = createMemo(() => {
    const themes = Object.keys(store.themes).length ? store.themes : THEME_JSON
    return resolveTerminalTheme(themes, store.active, store.mode, store.system)
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
  }) as ThemeResolved,
    selected: () => store.active,
    all: () => store.themes,
    syntax,
    subtleSyntax,
    mode: () => store.mode,
    setMode: (mode) => setStore("mode", mode),
    set: (theme) => appStore.setTheme(theme as ThemeName),
    ready,
  }

  return (
    <Show when={ready()}>
      <ThemeContext.Provider value={context}>{children}</ThemeContext.Provider>
    </Show>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
