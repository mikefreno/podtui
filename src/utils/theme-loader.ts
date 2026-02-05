import path from "path"
import type { ThemeJson } from "../types/theme-schema"
import { THEME_JSON } from "../constants/themes"

export async function loadTheme(name: string) {
  if (THEME_JSON[name]) return THEME_JSON[name]
  const file = path.resolve(process.cwd(), "themes", `${name}.json`)
  return loadThemeFromPath(file)
}

export async function loadThemeFromPath(file: string) {
  const json = (await Bun.file(file).json()) as ThemeJson
  validateTheme(json, file)
  return json
}

export async function getAllThemes() {
  return { ...THEME_JSON, ...(await getCustomThemes()) }
}

export async function getCustomThemes() {
  const dirs = [
    path.join(process.env.HOME ?? "", ".config/podtui/themes"),
    path.resolve(process.cwd(), ".podtui/themes"),
    path.resolve(process.cwd(), "themes"),
  ]

  const result: Record<string, ThemeJson> = {}
  for (const dir of dirs) {
    const glob = new Bun.Glob("*.json")
    for await (const item of glob.scan({ absolute: true, followSymlinks: true, cwd: dir })) {
      const name = path.basename(item, ".json")
      const json = (await Bun.file(item).json()) as ThemeJson
      validateTheme(json, item)
      result[name] = json
    }
  }
  return result
}

export function validateTheme(theme: ThemeJson, source?: string) {
  if (!theme || typeof theme !== "object") {
    throw new Error(`Invalid theme${source ? ` (${source})` : ""}`)
  }
  if (!theme.theme || typeof theme.theme !== "object") {
    throw new Error(`Theme missing 'theme' object${source ? ` (${source})` : ""}`)
  }
  return true
}
