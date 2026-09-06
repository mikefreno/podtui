/** Scratch: cava init/destroy cycles leak native fftw buffers? */
import { test, expect } from "bun:test"
import { loadCavaCore } from "../src/utils/cavacore"

const cava = loadCavaCore()
const skip = !cava

test.skipIf(skip)("init/destroy x50: RSS bounded", () => {
  const cfg = { bars: 64, sampleRate: 22050, channels: 1, autosens: 0 }
  const samples = new Float64Array(8192)
  Bun.gc(true)
  const startRss = process.memoryUsage.rss()
  for (let i = 0; i < 50; i++) {
    cava!.init(cfg)
    cava!.execute(samples)
    cava!.destroy()
  }
  Bun.gc(true)
  const endRss = process.memoryUsage.rss()
  const grown = (endRss - startRss) / 1048576
  console.log(`init/destroy x50: rss delta=${grown.toFixed(1)}MB`)
  expect(grown).toBeLessThan(100)
}, 60_000)
