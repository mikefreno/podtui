import type { RGBA } from "@opentui/core"

export type HexColor = `#${string}`
export type RefName = string

export type Variant = {
  dark: HexColor | RefName
  light: HexColor | RefName
}

export type ColorValue = HexColor | RefName | Variant | RGBA | number

export type ThemeJson = {
  $schema?: string
  defs?: Record<string, HexColor | RefName>
  theme: Record<string, ColorValue | boolean> & {
    selectedListItemText?: ColorValue
    backgroundMenu?: ColorValue
    thinkingOpacity?: number
    /** Render the app background transparent (let the terminal's own bg show). */
    transparent?: boolean
  }
}

export type ThemeColors = Record<string, RGBA> & {
  _hasSelectedListItemText: boolean
  thinkingOpacity: number
  textPrimary?: ColorValue
  textSecondary?: ColorValue
  textTertiary?: ColorValue
  textSelectedPrimary?: ColorValue
  textSelectedSecondary?: ColorValue
  textSelectedTertiary?: ColorValue
}
