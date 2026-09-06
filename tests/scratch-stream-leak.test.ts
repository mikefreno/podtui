/** Scratch: does the ffmpeg decode stream leak VM regions per chunk? */
import { test, expect } from "bun:test"
import { EpisodePcmCache } from "../src/utils/audio-pcm-cache"
import { spawnSync } from "child_process"

const wav = "/tmp/podtui-stream.wav"
if (!(await Bun.file(wav).exists()) && (await Bun.$`which ffmpeg`.nothrow())) {
  await Bun.$`ffmpeg -f lavfi -i "sine=frequency=440:duration=600" -ar 22050 -ac 1 -sample_fmt s16 ${wav}`.quiet().nothrow()
}

function regions(): number {
  const out = spawnSync("vmmap", [String(process.pid)], { timeout: 20000 }).stdout?.toString() ?? ""
  return out.split("\n").filter((l) => l.includes("VM_ALLOCATE")).length
}
function rss(): number {
  return Number(spawnSync("ps", ["-o", "rss=", "-p", String(process.pid)]).stdout?.toString().trim() || 0)
}

test("decode stream 90s: regions and rss bounded", async () => {
  Bun.gc(true)
  await Bun.sleep(200)
  const r0 = regions(), m0 = rss()
  const pcm = new EpisodePcmCache({ url: wav })
  pcm.startDecode(0)
  const t0 = Date.now()
  while (Date.now() - t0 < 90_000) {
    await Bun.sleep(5_000)
    const pos = ((Date.now() - t0) / 1000) * 4
    pcm.readWindow(new Float64Array(512), pos)
  }
  Bun.gc(true)
  const r1 = regions(), m1 = rss()
  console.log(`stream 90s: regions ${r0}->${r1} (delta ${r1 - r0}), rss ${(m0 / 1048576) | 0}->${(m1 / 1048576) | 0}MB`)
  pcm.stop()
  expect(r1 - r0).toBeLessThan(100)
}, 140_000)
