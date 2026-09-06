/** Scratch runner: decode stream, self-measure VM regions over time. */
import { EpisodePcmCache } from "../src/utils/audio-pcm-cache"
import { countRegions } from "./scratch-region-count"
const wav = "/tmp/podtui-stream.wav"
if (!(await Bun.file(wav).exists())) {
  await Bun.$`ffmpeg -f lavfi -i "sine=frequency=440:duration=600" -ar 22050 -ac 1 -sample_fmt s16 ${wav}`.quiet().nothrow()
}
const pcm = new EpisodePcmCache({ url: wav })
Bun.gc(true)
console.log(`start: ${JSON.stringify(countRegions())}`)
pcm.startDecode(0)
const t0 = Date.now()
const buf = new Float64Array(512)
while (Date.now() - t0 < 90_000) {
  await Bun.sleep(15_000)
  const pos = ((Date.now() - t0) / 1000) * 4
  pcm.readWindow(buf, pos)
  const c = countRegions()
  console.log(`t=${((Date.now() - t0) / 1000) | 0}s total=${c.total} r128k=${c.r128k} rss=${(process.memoryUsage.rss() / 1048576) | 0}MB`)
}
pcm.stop()
console.log("done")
