export type ThemeName = "system" | "catppuccin" | "gruvbox" | "tokyo" | "nord" | "custom"

export type LayerBackgrounds = {
  layer0: string
  layer1: string
  layer2: string
  layer3: string
}

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
  layerBackgrounds?: LayerBackgrounds
}

export type ThemeVariant = {
  name: string
  colors: ThemeColors
}

export type ThemeToken = {
  [key: string]: string
}

export type ResolvedTheme = ThemeColors & {
  layerBackgrounds: LayerBackgrounds
}

export type DesktopTheme = {
  name: string
  variants: ThemeVariant[]
  defaultVariant: string
  tokens: ThemeToken
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
