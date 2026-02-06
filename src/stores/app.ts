import { createSignal } from "solid-js"
import { DEFAULT_THEME, THEME_JSON } from "../constants/themes"
import type { AppSettings, AppState, ThemeColors, ThemeName, ThemeMode, UserPreferences } from "../types/settings"
import { resolveTheme } from "../utils/theme-resolver"
import type { ThemeJson } from "../types/theme-schema"
import {
  loadAppStateFromFile,
  saveAppStateToFile,
  migrateAppStateFromLocalStorage,
} from "../utils/app-persistence"

const defaultSettings: AppSettings = {
  theme: "system",
  fontSize: 14,
  playbackSpeed: 1,
  downloadPath: "",
}

const defaultPreferences: UserPreferences = {
  showExplicit: false,
  autoDownload: false,
}

const defaultState: AppState = {
  settings: defaultSettings,
  preferences: defaultPreferences,
  customTheme: DEFAULT_THEME,
}

export function createAppStore() {
  // Start with defaults; async load will update once ready
  const [state, setState] = createSignal<AppState>(defaultState)

  // Fire-and-forget async initialisation
  const init = async () => {
    await migrateAppStateFromLocalStorage()
    const loaded = await loadAppStateFromFile()
    setState(loaded)
  }
  init()

  const saveState = (next: AppState) => {
    saveAppStateToFile(next).catch(() => {})
  }

  const updateState = (next: AppState) => {
    setState(next)
    saveState(next)
  }

  const updateSettings = (updates: Partial<AppSettings>) => {
    const next = {
      ...state(),
      settings: { ...state().settings, ...updates },
    }
    updateState(next)
  }

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    const next = {
      ...state(),
      preferences: { ...state().preferences, ...updates },
    }
    updateState(next)
  }

  const updateCustomTheme = (updates: Partial<ThemeColors>) => {
    const next = {
      ...state(),
      customTheme: { ...state().customTheme, ...updates },
    }
    updateState(next)
  }

  const setTheme = (theme: ThemeName) => {
    updateSettings({ theme })
  }

  const resolveThemeColors = (): ThemeColors => {
    const theme = state().settings.theme
    if (theme === "custom") return state().customTheme
    if (theme === "system") return DEFAULT_THEME
    const json = THEME_JSON[theme]
    if (!json) return DEFAULT_THEME
    return resolveTheme(json as ThemeJson, "dark" as ThemeMode) as unknown as ThemeColors
  }

  return {
    state,
    updateSettings,
    updatePreferences,
    updateCustomTheme,
    setTheme,
    resolveTheme: resolveThemeColors,
  }
}

let appStoreInstance: ReturnType<typeof createAppStore> | null = null

export function useAppStore() {
  if (!appStoreInstance) {
    appStoreInstance = createAppStore()
  }
  return appStoreInstance
}
