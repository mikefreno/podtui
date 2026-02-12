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
  theme: Record<string, ColorValue> & {
    selectedListItemText?: ColorValue
    backgroundMenu?: ColorValue
    thinkingOpacity?: number
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
