import { createEffect, createMemo, onMount, onCleanup } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { useRenderer } from "@opentui/solid"
import type { ThemeName } from "../types/settings"
import type { ThemeJson } from "../types/theme-schema"
import { useAppStore } from "../stores/app"
import { THEME_JSON } from "../constants/themes"
import { generateSyntax, generateSubtleSyntax } from "../utils/syntax-highlighter"
import { resolveTerminalTheme, loadThemes } from "../utils/theme"
import { createSimpleContext } from "./helper"
import { setupThemeSignalHandler, emitThemeChanged, emitThemeModeChanged } from "../utils/theme-observer"
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

/**
 * Theme context using the createSimpleContext pattern.
 *
 * This ensures children are NOT rendered until the theme is ready,
 * preventing "useTheme must be used within a ThemeProvider" errors.
 *
 * The key insight from opencode's implementation is that the provider
 * uses `<Show when={ready}>` to gate rendering, so components can
 * safely call useTheme() without checking ready state.
 */
export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: { mode: "dark" | "light" }) => {
    const appStore = useAppStore()
    const renderer = useRenderer()
    const [store, setStore] = createStore({
      themes: THEME_JSON as Record<string, ThemeJson>,
      mode: props.mode,
      active: appStore.state().settings.theme as string,
      system: undefined as undefined | TerminalColors,
      ready: false,
    })

    function init() {
      resolveSystemTheme()
      loadThemes()
        .then((custom) => {
          setStore(
            produce((draft) => {
              Object.assign(draft.themes, custom)
            })
          )
        })
        .catch(() => {
          // If custom themes fail to load, fall back to opencode theme
          setStore("active", "opencode")
        })
        .finally(() => {
          // Only set ready if not waiting for system theme
          if (store.active !== "system") {
            setStore("ready", true)
          }
        })
    }

    function resolveSystemTheme() {
      renderer
        .getPalette({ size: 16 })
        .then((colors) => {
          if (!colors.palette[0]) {
            // No system colors available, fall back to default
            // This happens when the terminal doesn't support OSC palette queries
            // (e.g., running inside tmux, or on unsupported terminals)
            if (store.active === "system") {
              setStore(
                produce((draft) => {
                  draft.active = "opencode"
                  draft.ready = true
                })
              )
            }
            return
          }
          setStore(
            produce((draft) => {
              draft.system = colors
              if (store.active === "system") {
                draft.ready = true
              }
            })
          )
        })
        .catch(() => {
          // On error, fall back to default theme if using system
          if (store.active === "system") {
            setStore(
              produce((draft) => {
                draft.active = "opencode"
                draft.ready = true
              })
            )
          }
        })
    }

    onMount(init)

    // Setup SIGUSR2 signal handler for dynamic theme reload
    // This allows external tools to trigger a theme refresh by sending:
    // `kill -USR2 <pid>`
    const cleanupSignalHandler = setupThemeSignalHandler(() => {
      renderer.clearPaletteCache()
      init()
    })
    onCleanup(cleanupSignalHandler)

    // Sync active theme with app store settings
    createEffect(() => {
      const theme = appStore.state().settings.theme
      if (theme) setStore("active", theme)
    })

    // Emit theme change events for observers
    createEffect(() => {
      const theme = store.active
      const mode = store.mode
      if (store.ready) {
        emitThemeChanged(theme, mode)
      }
    })

    const values = createMemo(() => {
      return resolveTerminalTheme(store.themes, store.active, store.mode, store.system)
    })

    const syntax = createMemo(() => generateSyntax(values() as unknown as Record<string, RGBA>))
    const subtleSyntax = createMemo(() =>
      generateSubtleSyntax(values() as unknown as Record<string, RGBA> & { thinkingOpacity?: number })
    )

    return {
      theme: new Proxy(values(), {
        get(_target, prop) {
          // @ts-expect-error - dynamic property access
          return values()[prop]
        },
      }) as ThemeResolved,
      get selected() {
        return store.active
      },
      all() {
        return store.themes
      },
      syntax,
      subtleSyntax,
      mode() {
        return store.mode
      },
      setMode(mode: "dark" | "light") {
        setStore("mode", mode)
        emitThemeModeChanged(mode)
      },
      set(theme: string) {
        appStore.setTheme(theme as ThemeName)
      },
      get ready() {
        return store.ready
      },
    }
  },
})
