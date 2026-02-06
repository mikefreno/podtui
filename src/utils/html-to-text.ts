/**
 * HTML-to-text conversion for PodTUI
 *
 * Converts HTML content from RSS feed descriptions into clean plain text
 * suitable for display in the terminal. Preserves paragraph structure,
 * converts lists to bulleted text, and strips all tags.
 */

/**
 * Convert HTML content to readable plain text.
 *
 * - Block elements (<p>, <div>, <br>, headings, <li>) become line breaks
 * - <li> items get a bullet prefix
 * - <a href="...">text</a> becomes "text (url)"
 * - All other tags are stripped
 * - HTML entities are decoded
 * - Excessive whitespace is collapsed
 */
export function htmlToText(html: string): string {
  if (!html) return ""

  let text = html

  // Strip CDATA wrappers
  text = text.replace(/<!\[CDATA\[([\s\S]*?)]]>/gi, "$1")

  // Replace <br> / <br/> with newline
  text = text.replace(/<br\s*\/?>/gi, "\n")

  // Replace <hr> with a separator line
  text = text.replace(/<hr\s*\/?>/gi, "\n---\n")

  // Block-level elements get newlines before/after
  text = text.replace(/<\/?(p|div|blockquote|pre|h[1-6]|table|tr|section|article|header|footer)[\s>][^>]*>/gi, "\n")

  // List items get bullet prefix
  text = text.replace(/<li[^>]*>/gi, "\n  - ")
  text = text.replace(/<\/li>/gi, "")

  // Strip list wrappers
  text = text.replace(/<\/?(ul|ol|dl|dt|dd)[^>]*>/gi, "\n")

  // Convert links: <a href="url">text</a> -> text (url)
  text = text.replace(/<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, linkText) => {
    const cleanText = stripTags(linkText).trim()
    if (!cleanText) return href
    // Don't duplicate if the link text IS the URL
    if (cleanText === href || cleanText === href.replace(/^https?:\/\//, "")) return cleanText
    return `${cleanText} (${href})`
  })

  // Strip all remaining tags
  text = stripTags(text)

  // Decode HTML entities
  text = decodeHtmlEntities(text)

  // Collapse multiple blank lines into at most two newlines
  text = text.replace(/\n{3,}/g, "\n\n")

  // Collapse runs of spaces/tabs (but not newlines) on each line
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")

  return text.trim()
}

/** Strip all HTML/XML tags from a string */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "")
}

/** Decode common HTML entities */
function decodeHtmlEntities(text: string): string {
  return text
    // Named entities
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&hellip;/g, "\u2026")
    .replace(/&laquo;/g, "\u00AB")
    .replace(/&raquo;/g, "\u00BB")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&bull;/g, "\u2022")
    .replace(/&copy;/g, "\u00A9")
    .replace(/&reg;/g, "\u00AE")
    .replace(/&trade;/g, "\u2122")
    .replace(/&deg;/g, "\u00B0")
    .replace(/&times;/g, "\u00D7")
    // Numeric entities (decimal)
    .replace(/&#(\d+);/g, (_, code) => {
      const n = parseInt(code, 10)
      return n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : ""
    })
    // Numeric entities (hex)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const n = parseInt(hex, 16)
      return n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : ""
    })
}
