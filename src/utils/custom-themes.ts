import path from "path"
import { mkdir } from "fs/promises"
import type { ThemeJson } from "../types/theme-schema"
import { THEME_JSON } from "../constants/themes"
import { validateTheme } from "./theme-loader"

export async function getCustomThemes() {
  const home = process.env.HOME ?? ""
  if (!home) return {}

  const dir = path.join(home, ".config/podtui/themes")
  await mkdir(dir, { recursive: true })

  for (const [name, theme] of Object.entries(THEME_JSON)) {
    const file = path.join(dir, `${name}.json`)
    const exists = await Bun.file(file).exists()
    if (exists) continue
    await Bun.write(file, JSON.stringify(theme, null, 2))
  }

  const result: Record<string, ThemeJson> = {}
  const glob = new Bun.Glob("*.json")
  for await (const item of glob.scan({ absolute: true, followSymlinks: true, cwd: dir })) {
    const name = path.basename(item, ".json")
    const json = (await Bun.file(item).json()) as ThemeJson
    validateTheme(json, item)
    result[name] = json
  }
  return result
}
