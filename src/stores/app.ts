import { createSignal } from "solid-js"
import { DEFAULT_THEME, THEME_JSON } from "../constants/themes"
import type { AppSettings, AppState, ThemeColors, ThemeName, ThemeMode, UserPreferences } from "../types/settings"
import { resolveTheme } from "../utils/theme-resolver"
import type { ThemeJson } from "../types/theme-schema"

const STORAGE_KEY = "podtui_app_state"

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

const loadState = (): AppState => {
  if (typeof localStorage === "undefined") return defaultState
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      settings: { ...defaultSettings, ...parsed.settings },
      preferences: { ...defaultPreferences, ...parsed.preferences },
      customTheme: { ...DEFAULT_THEME, ...parsed.customTheme },
    }
  } catch {
    return defaultState
  }
}

const saveState = (state: AppState) => {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage errors
  }
}

export function createAppStore() {
  const [state, setState] = createSignal<AppState>(loadState())

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
