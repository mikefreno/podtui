import solidPlugin from "@opentui/solid/bun-plugin"
import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"

// Build the JavaScript bundle
await Bun.build({
  entrypoints: ["./src/index.tsx"],
  outdir: "./dist",
  target: "bun",
  minify: true,
  sourcemap: "external",
  plugins: [solidPlugin],
})

// Copy the native library to dist for distribution
const platform = process.platform
const arch = process.arch

// Map platform/arch to OpenTUI package names
const platformMap: Record<string, string> = {
  "darwin-arm64": "darwin-arm64",
  "darwin-x64": "darwin-x64",
  "linux-x64": "linux-x64",
  "linux-arm64": "linux-arm64",
  "win32-x64": "win32-x64",
  "win32-arm64": "win32-arm64",
}

const platformKey = `${platform}-${arch}`
const platformPkg = platformMap[platformKey]

if (platformPkg) {
  const libName = platform === "win32"
    ? "opentui.dll"
    : platform === "darwin"
      ? "libopentui.dylib"
      : "libopentui.so"
  const srcPath = join("node_modules", `@opentui/core-${platformPkg}`, libName)
  
  if (existsSync(srcPath)) {
    const destPath = join("dist", libName)
    copyFileSync(srcPath, destPath)
    console.log(`Copied native library: ${libName}`)
  }
}

// Copy cavacore native library to dist
const cavacoreLib = platform === "darwin"
  ? "libcavacore.dylib"
  : platform === "win32"
    ? "cavacore.dll"
    : "libcavacore.so"
const cavacoreSrc = join("src", "native", cavacoreLib)

if (existsSync(cavacoreSrc)) {
  copyFileSync(cavacoreSrc, join("dist", cavacoreLib))
  console.log(`Copied cavacore library: ${cavacoreLib}`)
} else {
  console.warn(`Warning: ${cavacoreSrc} not found — run scripts/build-cavacore.sh first`)
}

console.log("Build complete")
