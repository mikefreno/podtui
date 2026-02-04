export type ThemeName = "system" | "catppuccin" | "gruvbox" | "tokyo" | "nord" | "custom"

export type ThemeColors = {
  background: string
  surface: string
  primary: string
  secondary: string
  accent: string
  text: string
  muted: string
  warning: string
  error: string
  success: string
}

export type AppSettings = {
  theme: ThemeName
  fontSize: number
  playbackSpeed: number
  downloadPath: string
}

export type UserPreferences = {
  showExplicit: boolean
  autoDownload: boolean
}

export type AppState = {
  settings: AppSettings
  preferences: UserPreferences
  customTheme: ThemeColors
}
