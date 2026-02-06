/**
 * RSS content type detection for PodTUI
 *
 * Determines whether RSS feed content (description, etc.) is HTML or plain
 * text so the appropriate parsing path can be selected.
 */

export enum ContentType {
  HTML = "html",
  PLAIN_TEXT = "plain_text",
  UNKNOWN = "unknown",
}

/** Common HTML tags found in RSS descriptions */
const HTML_TAG_RE = /<\s*\/?\s*(div|p|br|a|b|i|em|strong|ul|ol|li|span|h[1-6]|img|table|tr|td|blockquote|pre|code|hr)\b[^>]*\/?>/i

/** HTML entity patterns beyond the basic five (&amp; etc.) */
const HTML_ENTITY_RE = /&(nbsp|mdash|ndash|hellip|laquo|raquo|ldquo|rdquo|lsquo|rsquo|bull|#\d{2,5}|#x[0-9a-fA-F]{2,4});/

/** CDATA wrapper — content inside is almost always HTML */
const CDATA_RE = /^\s*<!\[CDATA\[/

/**
 * Detect whether a string contains HTML markup or is plain text.
 */
export function detectContentType(content: string): ContentType {
  if (!content || content.trim().length === 0) return ContentType.UNKNOWN

  // CDATA-wrapped content is nearly always HTML
  if (CDATA_RE.test(content)) return ContentType.HTML

  // Check for standard HTML tags
  if (HTML_TAG_RE.test(content)) return ContentType.HTML

  // Check for extended HTML entities (basic &amp; / &lt; / etc. can appear in
  // plain text too, so we only look for the less common ones)
  if (HTML_ENTITY_RE.test(content)) return ContentType.HTML

  return ContentType.PLAIN_TEXT
}
