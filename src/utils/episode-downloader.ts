/**
 * Episode download utility for PodTUI
 *
 * Streams audio files from episode URLs to the local downloads directory
 * using fetch() + ReadableStream. Supports progress tracking and cancellation
 * via AbortController.
 */

import path from "path"
import { ensureDownloadsDir } from "./config-dir"

/** Progress callback info */
export interface DownloadProgress {
  /** Bytes downloaded so far */
  bytesDownloaded: number
  /** Total file size in bytes (0 if unknown) */
  totalBytes: number
  /** Progress percentage 0-100 (or -1 if total unknown) */
  percent: number
  /** Download speed in bytes/sec */
  speed: number
}

/** Download result */
export interface DownloadResult {
  /** Whether the download succeeded */
  success: boolean
  /** Absolute path to the downloaded file */
  filePath: string
  /** File size in bytes */
  fileSize: number
  /** Error message if failed */
  error?: string
}

/**
 * Sanitize a string for use as a filename.
 * Removes or replaces characters that are invalid in file paths.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+/, "")
    .slice(0, 200)
}

/**
 * Derive a filename from the episode URL or title.
 */
function deriveFilename(audioUrl: string, episodeTitle: string): string {
  // Try to extract filename from URL
  try {
    const url = new URL(audioUrl)
    const urlFilename = path.basename(url.pathname)
    if (urlFilename && urlFilename.includes(".")) {
      return sanitizeFilename(decodeURIComponent(urlFilename))
    }
  } catch {
    // Fall through to title-based name
  }

  // Fall back to sanitized title + .mp3
  const ext = ".mp3"
  return sanitizeFilename(episodeTitle) + ext
}

/**
 * Download an episode audio file with progress tracking and cancellation support.
 *
 * @param audioUrl - URL of the audio file to download
 * @param episodeTitle - Episode title (used for filename fallback)
 * @param feedId - Feed ID (used to organize downloads into subdirectories)
 * @param onProgress - Optional callback invoked periodically with download progress
 * @param abortSignal - Optional AbortSignal for cancellation
 * @returns DownloadResult with file path and size info
 */
export async function downloadEpisode(
  audioUrl: string,
  episodeTitle: string,
  feedId: string,
  onProgress?: (progress: DownloadProgress) => void,
  abortSignal?: AbortSignal,
): Promise<DownloadResult> {
  const downloadsDir = await ensureDownloadsDir()
  const feedDir = path.join(downloadsDir, feedId)
  await Bun.write(path.join(feedDir, ".keep"), "") // ensures dir exists
  const { unlink } = await import("fs/promises")
  await unlink(path.join(feedDir, ".keep")).catch(() => {})
  const { mkdir } = await import("fs/promises")
  await mkdir(feedDir, { recursive: true })

  const filename = deriveFilename(audioUrl, episodeTitle)
  const filePath = path.join(feedDir, filename)

  try {
    const response = await fetch(audioUrl, {
      signal: abortSignal,
      headers: {
        "Accept": "audio/*, */*",
        "Accept-Encoding": "identity",
      },
    })

    if (!response.ok) {
      return {
        success: false,
        filePath,
        fileSize: 0,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const contentLength = parseInt(response.headers.get("content-length") ?? "0", 10)
    const body = response.body

    if (!body) {
      return {
        success: false,
        filePath,
        fileSize: 0,
        error: "No response body",
      }
    }

    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let bytesDownloaded = 0
    let lastProgressTime = Date.now()
    let lastProgressBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      bytesDownloaded += value.length

      // Report progress roughly every 250ms
      const now = Date.now()
      if (onProgress && now - lastProgressTime >= 250) {
        const elapsed = (now - lastProgressTime) / 1000
        const speed = elapsed > 0 ? (bytesDownloaded - lastProgressBytes) / elapsed : 0
        const percent = contentLength > 0
          ? Math.round((bytesDownloaded / contentLength) * 100)
          : -1

        onProgress({ bytesDownloaded, totalBytes: contentLength, percent, speed })
        lastProgressTime = now
        lastProgressBytes = bytesDownloaded
      }
    }

    // Concatenate chunks and write to file
    const totalSize = bytesDownloaded
    const buffer = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of chunks) {
      buffer.set(chunk, offset)
      offset += chunk.length
    }

    await Bun.write(filePath, buffer)

    // Final progress report
    if (onProgress) {
      onProgress({
        bytesDownloaded: totalSize,
        totalBytes: contentLength || totalSize,
        percent: 100,
        speed: 0,
      })
    }

    return {
      success: true,
      filePath,
      fileSize: totalSize,
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        success: false,
        filePath,
        fileSize: 0,
        error: "Download cancelled",
      }
    }

    const message = err instanceof Error ? err.message : "Unknown download error"
    return {
      success: false,
      filePath,
      fileSize: 0,
      error: message,
    }
  }
}
