import type { ThemeJson } from "../types/theme-schema"

export function validateTheme(theme: ThemeJson, source?: string) {
  if (!theme || typeof theme !== "object") {
    throw new Error(`Invalid theme${source ? ` (${source})` : ""}`)
  }
  if (!theme.theme || typeof theme.theme !== "object") {
    throw new Error(`Theme missing 'theme' object${source ? ` (${source})` : ""}`)
  }
  return true
}
