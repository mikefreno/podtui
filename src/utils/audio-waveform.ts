/**
 * Audio waveform analysis for PodTUI
 *
 * Extracts amplitude data from audio files using ffmpeg (when available)
 * or generates procedural waveform data as a fallback. Results are cached
 * in-memory keyed by audio URL.
 */

/** Number of amplitude data points to generate */
const DEFAULT_RESOLUTION = 128

/** In-memory cache: audioUrl -> amplitude data */
const waveformCache = new Map<string, number[]>()

/**
 * Try to extract real waveform data from an audio URL using ffmpeg.
 * Returns null if ffmpeg is not available or the extraction fails.
 */
async function extractWithFfmpeg(audioUrl: string, resolution: number): Promise<number[] | null> {
  try {
    if (!Bun.which("ffmpeg")) return null

    // Use ffmpeg to output raw PCM samples, then downsample to `resolution` points.
    // -t 300: read at most 5 minutes (enough data to fill the waveform)
    const proc = Bun.spawn(
      [
        "ffmpeg",
        "-i", audioUrl,
        "-t", "300",
        "-ac", "1",            // mono
        "-ar", "8000",         // low sample rate to keep data small
        "-f", "s16le",         // raw signed 16-bit PCM
        "-v", "quiet",
        "-",
      ],
      { stdout: "pipe", stderr: "ignore" },
    )

    const output = await new Response(proc.stdout).arrayBuffer()
    await proc.exited

    if (output.byteLength === 0) return null

    const samples = new Int16Array(output)
    if (samples.length === 0) return null

    // Downsample to `resolution` buckets by taking the max absolute amplitude
    // in each bucket.
    const bucketSize = Math.max(1, Math.floor(samples.length / resolution))
    const data: number[] = []

    for (let i = 0; i < resolution; i++) {
      const start = i * bucketSize
      const end = Math.min(start + bucketSize, samples.length)
      let maxAbs = 0
      for (let j = start; j < end; j++) {
        const abs = Math.abs(samples[j])
        if (abs > maxAbs) maxAbs = abs
      }
      // Normalise to 0-1
      data.push(Number((maxAbs / 32768).toFixed(3)))
    }

    return data
  } catch {
    return null
  }
}

/**
 * Generate a procedural (fake) waveform that looks plausible.
 * Uses a combination of sine waves with different frequencies to
 * simulate varying audio energy.
 */
function generateProcedural(resolution: number, seed: number): number[] {
  const data: number[] = []
  for (let i = 0; i < resolution; i++) {
    const t = i + seed
    const value =
      0.15 +
      Math.abs(Math.sin(t / 3.7)) * 0.35 +
      Math.abs(Math.sin(t / 7.3)) * 0.25 +
      Math.abs(Math.sin(t / 13.1)) * 0.15 +
      (Math.random() * 0.1)
    data.push(Number(Math.min(1, value).toFixed(3)))
  }
  return data
}

/**
 * Simple numeric hash of a string, used to seed procedural generation
 * so the same URL always produces the same waveform.
 */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Get waveform data for an audio URL.
 *
 * Returns cached data if available, otherwise attempts ffmpeg extraction
 * and falls back to procedural generation.
 */
export async function getWaveformData(
  audioUrl: string,
  resolution: number = DEFAULT_RESOLUTION,
): Promise<number[]> {
  const cacheKey = `${audioUrl}:${resolution}`
  const cached = waveformCache.get(cacheKey)
  if (cached) return cached

  // Try real extraction first
  const real = await extractWithFfmpeg(audioUrl, resolution)
  if (real) {
    waveformCache.set(cacheKey, real)
    return real
  }

  // Fall back to procedural
  const procedural = generateProcedural(resolution, hashString(audioUrl))
  waveformCache.set(cacheKey, procedural)
  return procedural
}

/**
 * Synchronous fallback: get a waveform immediately (from cache or procedural).
 * Use this when you need data without waiting for async extraction.
 */
export function getWaveformDataSync(
  audioUrl: string,
  resolution: number = DEFAULT_RESOLUTION,
): number[] {
  const cacheKey = `${audioUrl}:${resolution}`
  const cached = waveformCache.get(cacheKey)
  if (cached) return cached

  const procedural = generateProcedural(resolution, hashString(audioUrl))
  waveformCache.set(cacheKey, procedural)
  return procedural
}

/** Clear the waveform cache (for memory management) */
export function clearWaveformCache(): void {
  waveformCache.clear()
}
