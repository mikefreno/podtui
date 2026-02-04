import solidPlugin from "@opentui/solid/bun-plugin"

await Bun.build({
  entrypoints: ["./src/index.tsx"],
  outdir: "./dist",
  target: "bun",
  minify: true,
  sourcemap: "external",
  plugins: [solidPlugin],
})

console.log("Build complete")
