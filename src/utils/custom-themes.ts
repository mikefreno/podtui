import path from "path"
import type { ThemeJson } from "../types/theme-schema"
import { validateTheme } from "./theme-loader"

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
