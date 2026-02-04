import type { AppSettings, UserPreferences } from "../types/settings"
import type { Feed } from "../types/feed"

const STORAGE_KEYS = {
  settings: "podtui_settings",
  preferences: "podtui_preferences",
  feeds: "podtui_feeds",
}

export const savePreference = (key: keyof UserPreferences, value: boolean) => {
  const current = loadPreferences()
  const next = { ...current, [key]: value }
  savePreferences(next)
}

export const loadPreference = (key: keyof UserPreferences) => {
  return loadPreferences()[key]
}

export const saveSettings = (settings: AppSettings) => {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

export const loadSettings = (): AppSettings | null => {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings)
    return raw ? (JSON.parse(raw) as AppSettings) : null
  } catch {
    return null
  }
}

export const savePreferences = (preferences: UserPreferences) => {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(preferences))
  } catch {
    // ignore
  }
}

export const loadPreferences = (): UserPreferences => {
  if (typeof localStorage === "undefined") {
    return { showExplicit: false, autoDownload: false }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.preferences)
    return raw ? (JSON.parse(raw) as UserPreferences) : { showExplicit: false, autoDownload: false }
  } catch {
    return { showExplicit: false, autoDownload: false }
  }
}

export const saveFeeds = (feeds: Feed[]) => {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEYS.feeds, JSON.stringify(feeds))
  } catch {
    // ignore
  }
}

export const loadFeeds = (): Feed[] => {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.feeds)
    return raw ? (JSON.parse(raw) as Feed[]) : []
  } catch {
    return []
  }
}
