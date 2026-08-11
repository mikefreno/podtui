/**
 * iTunes feed resolution for shows delisted from Apple Podcasts.
 *
 * The iTunes Search API returns `feedUrl: null` for shows that left Apple
 * Podcasts (e.g. The Daily Wire's shows in 2021) — the directory keeps a
 * metadata-only stub. The show's public Apple Podcasts page still embeds the
 * real feed URL in its JSON state (`showOffer.feedUrl`), so subscribing can
 * resolve it from there.
 */

/** `"feedUrl":"https://..."` as embedded in the Apple page's JSON state. */
const FEED_URL_RE = /"feedUrl"\s*:\s*"(https?:\/\/[^"]+)"/

/**
 * Extract the show's feed URL from an Apple Podcasts page's HTML.
 *
 * The page embeds `showOffer` blocks for the show AND for related shows, each
 * with its own feedUrl, and Apple serves multiple JSON variants — the main
 * show's showOffer may sit adjacent to its adamId or thousands of chars later.
 * Anchor on the collection id from `directoryUrl` (`"adamId":"<id>"`) and take
 * the FIRST feedUrl after it (the main show's content precedes related shows'
 * in the document). Falls back to the first feedUrl in the document only when
 * the id isn't present in the URL. Returns null when no trustworthy match
 * exists (page restructured, no feed) — callers must not guess.
 */
export const extractFeedUrlFromPage = (
  html: string,
  directoryUrl: string,
): string | null => {
  const idMatch = /[?/]id(\d+)/.exec(directoryUrl)
  if (!idMatch) {
    const fallback = FEED_URL_RE.exec(html)
    return fallback ? fallback[1] : null
  }

  const adamIdx = html.search(new RegExp(`"adamId"\\s*:\\s*"${idMatch[1]}"`))
  if (adamIdx < 0) return null

  const fromAdam = new RegExp(FEED_URL_RE.source, "g")
  fromAdam.lastIndex = adamIdx
  const match = fromAdam.exec(html)
  return match ? match[1] : null
}

/**
 * Resolve a delisted show's RSS feed from its Apple Podcasts page.
 * Returns null on network failure or when the page has no resolvable feed.
 */
export const resolveItunesFeedUrl = async (
  directoryUrl: string,
): Promise<string | null> => {
  try {
    const response = await fetch(directoryUrl, {
      headers: { "User-Agent": "PodTUI/1.0" },
    })
    if (!response.ok) return null
    return extractFeedUrlFromPage(await response.text(), directoryUrl)
  } catch {
    return null
  }
}
