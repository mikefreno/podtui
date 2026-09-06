/**
 * CavaCore.init() must be a no-op for an identical config: re-initializing
 * the same plan leaks the old plan's native FFTW work buffers, so pipeline
 * restarts (focus/episode churn) have to re-USE the live plan.
 */
import { test, expect } from "bun:test"
import { CavaCore } from "../src/utils/cavacore"

function stubLib() {
  const calls = { init: 0, destroy: 0 }
  let plans = 0
  const lib = {
    symbols: {
      cava_init: () => {
        calls.init++
        return { p: ++plans }
      },
      cava_execute: () => {},
      cava_destroy: () => {
        calls.destroy++
      },
    },
    close: () => {},
  }
  return { lib, calls }
}

test("identical init config reuses the plan", () => {
  const { lib, calls } = stubLib()
  const cava = new CavaCore(lib as never)
  const cfg = { bars: 64, sampleRate: 22050, channels: 1, autosens: 0 }
  cava.init(cfg)
  cava.init(cfg)
  cava.init(cfg)
  expect(calls.init).toBe(1)
  expect(cava.isReady).toBe(true)
})

test("changed config re-inits, destroying the old plan", () => {
  const { lib, calls } = stubLib()
  const cava = new CavaCore(lib as never)
  cava.init({ bars: 64, sampleRate: 22050, channels: 1, autosens: 0 })
  cava.init({ bars: 32, sampleRate: 22050, channels: 1, autosens: 0 })
  expect(calls.init).toBe(2)
  expect(calls.destroy).toBe(1)
  expect(cava.bars).toBe(32)
})

test("init after destroy creates a fresh plan", () => {
  const { lib, calls } = stubLib()
  const cava = new CavaCore(lib as never)
  const cfg = { bars: 64, sampleRate: 22050, channels: 1, autosens: 0 }
  cava.init(cfg)
  cava.destroy()
  cava.init(cfg)
  expect(calls.init).toBe(2)
  expect(cava.isReady).toBe(true)
})
