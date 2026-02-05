import { RGBA, SyntaxStyle } from "@opentui/core"
import { getSyntaxRules } from "./syntax-rules"

export function generateSyntax(theme: Record<string, RGBA>) {
  return SyntaxStyle.fromTheme(getSyntaxRules(theme))
}

export function generateSubtleSyntax(theme: Record<string, RGBA> & { thinkingOpacity?: number }) {
  const rules = getSyntaxRules(theme)
  const opacity = theme.thinkingOpacity ?? 0.6
  return SyntaxStyle.fromTheme(
    rules.map((rule) => {
      if (!rule.style.foreground) return rule
      const fg = rule.style.foreground
      return {
        ...rule,
        style: {
          ...rule.style,
          foreground: RGBA.fromInts(
            Math.round(fg.r * 255),
            Math.round(fg.g * 255),
            Math.round(fg.b * 255),
            Math.round(opacity * 255)
          ),
        },
      }
    })
  )
}
