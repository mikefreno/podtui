/** Minimal opentui app: VM region growth from render loop and/or text churn. */
import { appendFileSync } from "node:fs"
import { createSignal } from "solid-js"
import { render } from "@opentui/solid"
import { countRegions } from "./scratch-region-count"

const CHURN = Bun.argv.includes("--churn")
const OUT = Bun.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "/tmp/render-leak.log"
const log = (m: string) => Bun.write(Bun.stderr, m + "\n") // stderr may be hijacked too; use fd via file:
const append = (m: string) => appendFileSync(OUT, m + "\n")

const [s, setS] = createSignal("hello")
if (CHURN) {
  let i = 0
  setInterval(() => setS(`hello ${++i} ${"x".repeat(i % 50)}`), 33)
}

render(() => <text>{s()}</text>)
await Bun.sleep(1000)
const c0 = countRegions()
append(`start churn=${CHURN}: total=${c0.total}`)
for (let w = 1; w <= 4; w++) {
  await Bun.sleep(15_000)
  const c = countRegions()
  append(`t=${w * 15}s total=${c.total} (delta ${c.total - c0.total})`)
}
process.exit(0)
