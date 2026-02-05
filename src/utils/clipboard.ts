import { $ } from "bun"
import { platform, release } from "os"
import { tmpdir } from "os"
import path from "path"

/**
 * Writes text to clipboard via OSC 52 escape sequence.
 * This allows clipboard operations to work over SSH by having
 * the terminal emulator handle the clipboard locally.
 */
function writeOsc52(text: string): void {
  if (!process.stdout.isTTY) return
  const base64 = Buffer.from(text).toString("base64")
  const osc52 = `\x1b]52;c;${base64}\x07`
  const passthrough = process.env["TMUX"] || process.env["STY"]
  const sequence = passthrough ? `\x1bPtmux;\x1b${osc52}\x1b\\` : osc52
  process.stdout.write(sequence)
}

/**
 * Lazy initialization for clipboard copy method.
 * Detects the best clipboard method for the current platform.
 */
function createLazy<T>(factory: () => T): () => T {
  let value: T | undefined
  return () => {
    if (value === undefined) {
      value = factory()
    }
    return value
  }
}

export namespace Clipboard {
  export interface Content {
    data: string
    mime: string
  }

  /**
   * Read content from the clipboard.
   * Supports text and image (PNG) content on macOS, Windows, and Linux.
   */
  export async function read(): Promise<Content | undefined> {
    const os = platform()

    // macOS: Try to read PNG image first
    if (os === "darwin") {
      const tmpfile = path.join(tmpdir(), "podtui-clipboard.png")
      try {
        await $`osascript -e 'set imageData to the clipboard as "PNGf"' -e 'set fileRef to open for access POSIX file "${tmpfile}" with write permission' -e 'set eof fileRef to 0' -e 'write imageData to fileRef' -e 'close access fileRef'`
          .nothrow()
          .quiet()
        const file = Bun.file(tmpfile)
        const buffer = await file.arrayBuffer()
        if (buffer.byteLength > 0) {
          return { data: Buffer.from(buffer).toString("base64"), mime: "image/png" }
        }
      } catch {
        // Ignore errors, fall through to text
      } finally {
        await $`rm -f "${tmpfile}"`.nothrow().quiet()
      }
    }

    // Windows/WSL: Try to read PNG image
    if (os === "win32" || release().includes("WSL")) {
      const script =
        "Add-Type -AssemblyName System.Windows.Forms; $img = [System.Windows.Forms.Clipboard]::GetImage(); if ($img) { $ms = New-Object System.IO.MemoryStream; $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); [System.Convert]::ToBase64String($ms.ToArray()) }"
      const base64 = await $`powershell.exe -NonInteractive -NoProfile -command "${script}"`.nothrow().text()
      if (base64) {
        const imageBuffer = Buffer.from(base64.trim(), "base64")
        if (imageBuffer.length > 0) {
          return { data: imageBuffer.toString("base64"), mime: "image/png" }
        }
      }
    }

    // Linux: Try Wayland or X11
    if (os === "linux") {
      // Try Wayland first
      const wayland = await $`wl-paste -t image/png`.nothrow().arrayBuffer()
      if (wayland && wayland.byteLength > 0) {
        return { data: Buffer.from(wayland).toString("base64"), mime: "image/png" }
      }
      // Try X11
      const x11 = await $`xclip -selection clipboard -t image/png -o`.nothrow().arrayBuffer()
      if (x11 && x11.byteLength > 0) {
        return { data: Buffer.from(x11).toString("base64"), mime: "image/png" }
      }
    }

    // Fall back to reading text
    try {
      const text = await readText()
      if (text) {
        return { data: text, mime: "text/plain" }
      }
    } catch {
      // Ignore errors
    }

    return undefined
  }

  /**
   * Read text from the clipboard.
   */
  export async function readText(): Promise<string | undefined> {
    const os = platform()

    if (os === "darwin") {
      const result = await $`pbpaste`.nothrow().text()
      return result || undefined
    }

    if (os === "linux") {
      // Try Wayland first
      if (process.env["WAYLAND_DISPLAY"]) {
        const result = await $`wl-paste`.nothrow().text()
        if (result) return result
      }
      // Try X11
      const result = await $`xclip -selection clipboard -o`.nothrow().text()
      return result || undefined
    }

    if (os === "win32" || release().includes("WSL")) {
      const result = await $`powershell.exe -NonInteractive -NoProfile -command "Get-Clipboard"`.nothrow().text()
      return result?.trim() || undefined
    }

    return undefined
  }

  const getCopyMethod = createLazy(() => {
    const os = platform()

    if (os === "darwin" && Bun.which("osascript")) {
      return async (text: string) => {
        const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        await $`osascript -e 'set the clipboard to "${escaped}"'`.nothrow().quiet()
      }
    }

    if (os === "linux") {
      if (process.env["WAYLAND_DISPLAY"] && Bun.which("wl-copy")) {
        return async (text: string) => {
          const proc = Bun.spawn(["wl-copy"], { stdin: "pipe", stdout: "ignore", stderr: "ignore" })
          proc.stdin.write(text)
          proc.stdin.end()
          await proc.exited.catch(() => {})
        }
      }
      if (Bun.which("xclip")) {
        return async (text: string) => {
          const proc = Bun.spawn(["xclip", "-selection", "clipboard"], {
            stdin: "pipe",
            stdout: "ignore",
            stderr: "ignore",
          })
          proc.stdin.write(text)
          proc.stdin.end()
          await proc.exited.catch(() => {})
        }
      }
      if (Bun.which("xsel")) {
        return async (text: string) => {
          const proc = Bun.spawn(["xsel", "--clipboard", "--input"], {
            stdin: "pipe",
            stdout: "ignore",
            stderr: "ignore",
          })
          proc.stdin.write(text)
          proc.stdin.end()
          await proc.exited.catch(() => {})
        }
      }
    }

    if (os === "win32") {
      return async (text: string) => {
        // Pipe via stdin to avoid PowerShell string interpolation ($env:FOO, $(), etc.)
        const proc = Bun.spawn(
          [
            "powershell.exe",
            "-NonInteractive",
            "-NoProfile",
            "-Command",
            "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd())",
          ],
          {
            stdin: "pipe",
            stdout: "ignore",
            stderr: "ignore",
          },
        )

        proc.stdin.write(text)
        proc.stdin.end()
        await proc.exited.catch(() => {})
      }
    }

    // Fallback: No native clipboard support
    return async (_text: string) => {
      console.warn("No clipboard support available on this platform")
    }
  })

  /**
   * Copy text to the clipboard.
   * Uses OSC 52 for SSH/tmux support and native clipboard for local.
   */
  export async function copy(text: string): Promise<void> {
    // Always try OSC 52 first for SSH/tmux support
    writeOsc52(text)
    // Then use native clipboard
    await getCopyMethod()(text)
  }
}
