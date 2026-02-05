import { RGBA } from "@opentui/core"

export function tint(base: RGBA, overlay: RGBA, alpha: number) {
  const r = base.r + (overlay.r - base.r) * alpha
  const g = base.g + (overlay.g - base.g) * alpha
  const b = base.b + (overlay.b - base.b) * alpha
  return RGBA.fromInts(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255))
}

export function generateGrayScale(bg: RGBA, isDark: boolean) {
  const grays: Record<number, RGBA> = {}
  const bgR = bg.r * 255
  const bgG = bg.g * 255
  const bgB = bg.b * 255
  const luminance = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB

  for (let i = 1; i <= 12; i++) {
    const factor = i / 12.0

    if (isDark) {
      if (luminance < 10) {
        const gray = Math.floor(factor * 0.4 * 255)
        grays[i] = RGBA.fromInts(gray, gray, gray)
      } else {
        const newLum = luminance + (255 - luminance) * factor * 0.4
        const ratio = newLum / luminance
        grays[i] = RGBA.fromInts(
          Math.min(bgR * ratio, 255),
          Math.min(bgG * ratio, 255),
          Math.min(bgB * ratio, 255)
        )
      }
    } else {
      if (luminance > 245) {
        const gray = Math.floor(255 - factor * 0.4 * 255)
        grays[i] = RGBA.fromInts(gray, gray, gray)
      } else {
        const newLum = luminance * (1 - factor * 0.4)
        const ratio = newLum / luminance
        grays[i] = RGBA.fromInts(
          Math.max(bgR * ratio, 0),
          Math.max(bgG * ratio, 0),
          Math.max(bgB * ratio, 0)
        )
      }
    }
  }

  return grays
}

export function generateMutedTextColor(bg: RGBA, isDark: boolean) {
  const bgR = bg.r * 255
  const bgG = bg.g * 255
  const bgB = bg.b * 255
  const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB

  if (isDark) {
    if (bgLum < 10) return RGBA.fromInts(180, 180, 180)
    const gray = Math.min(Math.floor(160 + bgLum * 0.3), 200)
    return RGBA.fromInts(gray, gray, gray)
  }

  if (bgLum > 245) return RGBA.fromInts(75, 75, 75)
  const gray = Math.max(Math.floor(100 - (255 - bgLum) * 0.2), 60)
  return RGBA.fromInts(gray, gray, gray)
}
