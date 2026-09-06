/** bars signal writes are throttled to ~10fps; the render loop still runs 30fps. */
import { test, expect } from "bun:test"
import { join } from "path"
import { tmpdir } from "os"

process.env.XDG_CONFIG_HOME = join(tmpdir(), `podtui-th-${process.pid}`)
process.env.XDG_DATA_HOME = join(tmpdir(), `podtui-th-data-${process.pid}`)
process.env.PODTUI_AUDIO_BACKEND = "none"

const { useVisualizer } = await import("../src/stores/visualizer")
const { setCurrentEpisode, setIsPlaying, setPosition } = await import("../src/utils/audio-signals")
import type { Episode } from "../src/types/episode"

const wavPath = "/tmp/podtui-pause-cycle.wav"
const skip = !(Bun.which("ffmpeg") && Bun.file(wavPath).exists())

test.skipIf(skip)("barData updates at ~10fps while the loop runs at 30fps", async () => {
  const viz = useVisualizer()
  viz.setBarCount(64)
  viz.setFocused(true)
  setCurrentEpisode({ audioUrl: wavPath } as unknown as Episode)
  setIsPlaying(true)
  setPosition(5)
  for (let i = 0; i < 200 && !(viz.barData().length > 0); i++) await Bun.sleep(25)

  let writes = 0
  let prev = viz.barData()
  // count distinct array references the signal produced over 1s
  const check = setInterval(() => {
    const cur = viz.barData()
    if (cur !== prev) {
      writes++
      prev = cur
    }
  }, 16)
  await Bun.sleep(1000)
  clearInterval(check)
  console.log(`barData writes in 1s: ${writes} (30fps loop would be ~15-20 distinct seen at 16ms sampling)`)
  expect(writes).toBeGreaterThan(3)
  expect(writes).toBeLessThanOrEqual(14)
}, 30_000)
