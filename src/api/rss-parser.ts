import type { Podcast } from "../types/podcast"
import type { Episode, EpisodeType } from "../types/episode"
import { detectContentType, ContentType } from "../utils/rss-content-detector"
import { htmlToText } from "../utils/html-to-text"

const getTagValue = (xml: string, tag: string): string => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))
  return match?.[1]?.trim() ?? ""
}

/** Get an attribute value from a self-closing or open tag */
const getAttr = (xml: string, tag: string, attr: string): string => {
  const tagMatch = xml.match(new RegExp(`<${tag}[^>]*>`, "i"))
  if (!tagMatch) return ""
  const attrMatch = tagMatch[0].match(new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "i"))
  return attrMatch?.[1] ?? ""
}

const decodeEntities = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

/**
 * Clean a field (description or title): detect HTML vs plain text, and convert
 * HTML to readable plain text. Plain text just gets entity decoding.
 */
const cleanField = (raw: string): string => {
  if (!raw) return ""
  const decoded = decodeEntities(raw)
  const type = detectContentType(decoded)
  if (type === ContentType.HTML) {
    return htmlToText(decoded)
  }
  return decoded
}

/**
 * Parse an itunes:duration value which can be:
 *   - "HH:MM:SS"
 *   - "MM:SS"
 *   - seconds as a plain number string (e.g. "1234")
 * Returns duration in seconds, or 0 if unparseable.
 */
const parseDuration = (raw: string): number => {
  if (!raw) return 0
  const trimmed = raw.trim()

  // Pure numeric (seconds)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10)
  }

  // HH:MM:SS or MM:SS
  const parts = trimmed.split(":").map(Number)
  if (parts.some(isNaN)) return 0
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return 0
}

const parseEpisodeType = (raw: string): EpisodeType | undefined => {
  const lower = raw.trim().toLowerCase()
  if (lower === "trailer") return "trailer" as EpisodeType
  if (lower === "bonus") return "bonus" as EpisodeType
  if (lower === "full") return "full" as EpisodeType
  return undefined
}

/** FNV-1a 32-bit hash. Deterministic across processes and Bun versions
 *  (unlike Bun.hash) — used to derive stable episode ids from audio URLs so
 *  a feed's episode ids never change between refreshes. */
const fnv1a = (input: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Stable per-episode identity. The old positional id (`feedUrl#index`) was
 * invalidated by ANY feed change: a new episode or a pruned one shifted
 * every episode's index, so progress/downloads saved under `feedUrl#5`
 * attached to whatever episode now sat at index 5 — new episodes resumed
 * minutes in. Identity derives from stable content instead:
 *   1. `<guid>` — the canonical per-episode identifier (required by Apple
 *      Podcasts; nearly universal).
 *   2. The enclosure URL, hashed to keep the id compact (hosts serve
 *      permanent per-episode URLs; guids can be absent in hand-rolled feeds).
 *   3. Positional index as a last resort: no guid AND no audio URL means
 *      the episode cannot be played, so nothing persistent keys off it.
 */
const stableEpisodeId = (
  feedUrl: string,
  item: string,
  audioUrl: string,
  index: number,
): string => {
  const guid = getTagValue(item, "guid")
  if (guid) return `${feedUrl}#guid:${guid}`
  if (audioUrl) return `${feedUrl}#url:${fnv1a(audioUrl).toString(36)}`
  return `${feedUrl}#${index}`
}

/** Extract the `<item>` blocks from an RSS document. Matches items directly
 *  on the full XML string — scoping to <channel> first is a redundant 5MB
 *  regex pass that doubles parse cost with no practical benefit (well-formed
 *  RSS has no items outside <channel>). */
export const getRSSItems = (xml: string): string[] => {
  return xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
}

/** Channel-level artwork: `<itunes:image href>` (podcasts) or RSS 2.0
 *  `<image><url>`. Works on the full XML — channel-level tags precede
 *  <item> blocks in RSS, so the first match is the channel image. */
export const parseChannelCoverUrl = (xml: string): string | undefined => {
  const itunesHref = getAttr(xml, "itunes:image", "href")
  if (itunesHref) return itunesHref
  const url = getTagValue(xml, "image").match(/<url>([\s\S]*?)<\/url>/i)?.[1]
  return url?.trim() || undefined
}

/** Parse a single `<item>` into an Episode. Exported so the feed store can
 *  parse large feeds in bounded chunks (yielding to the event loop between
 *  chunks) instead of one synchronous block. */
export const parseRSSItem = (item: string, feedUrl: string, index: number): Episode => {
  const epTitle = cleanField(getTagValue(item, "title")) || `Episode ${index + 1}`
  const epDescription = cleanField(getTagValue(item, "description"))
  const pubDate = new Date(getTagValue(item, "pubDate") || Date.now())

  const enclosure = item.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*>/i)
  const audioUrl = enclosure?.[1] ?? ""
  const fileSizeStr = getAttr(item, "enclosure", "length")
  const fileSize = fileSizeStr ? parseInt(fileSizeStr, 10) : undefined
  const mimeType = getAttr(item, "enclosure", "type") || undefined

  const durationRaw = getTagValue(item, "itunes:duration")
  const duration = parseDuration(durationRaw)

  const episodeNumRaw = getTagValue(item, "itunes:episode")
  const episodeNumber = episodeNumRaw ? parseInt(episodeNumRaw, 10) : undefined
  const seasonNumRaw = getTagValue(item, "itunes:season")
  const seasonNumber = seasonNumRaw ? parseInt(seasonNumRaw, 10) : undefined

  const episodeType = parseEpisodeType(getTagValue(item, "itunes:episodeType"))
  const explicitRaw = getTagValue(item, "itunes:explicit").toLowerCase()
  const explicit = explicitRaw === "yes" || explicitRaw === "true" ? true : undefined

  // Episode image (itunes:image has href attribute)
  const imageUrl = getAttr(item, "itunes:image", "href") || undefined

  const ep: Episode = {
    id: stableEpisodeId(feedUrl, item, audioUrl, index),
    podcastId: feedUrl,
    title: epTitle,
    description: epDescription,
    audioUrl,
    duration,
    pubDate,
  }

  if (episodeNumber !== undefined && !isNaN(episodeNumber)) ep.episodeNumber = episodeNumber
  if (seasonNumber !== undefined && !isNaN(seasonNumber)) ep.seasonNumber = seasonNumber
  if (episodeType) ep.episodeType = episodeType
  if (explicit !== undefined) ep.explicit = explicit
  if (imageUrl) ep.imageUrl = imageUrl
  if (fileSize !== undefined && !isNaN(fileSize) && fileSize > 0) ep.fileSize = fileSize
  if (mimeType) ep.mimeType = mimeType

  return ep
}

/** Parse a full RSS document (channel metadata + all episodes). The sync
 *  whole-feed variant — callers that parse potentially huge feeds on a UI
 *  thread should prefer the store's chunked incremental parse instead. */
export const parseRSSFeed = (xml: string, feedUrl: string): Podcast & { episodes: Episode[] } => {
  const channel = xml.match(/<channel[\s\S]*?<\/channel>/i)?.[0] ?? xml
  const title = cleanField(getTagValue(channel, "title")) || "Untitled Podcast"
  const description = cleanField(getTagValue(channel, "description"))
  const author = decodeEntities(getTagValue(channel, "itunes:author"))
  const lastUpdated = new Date()

  const items = getRSSItems(xml)
  const episodes = items.map((item, index) => parseRSSItem(item, feedUrl, index))

  return {
    id: feedUrl,
    title,
    description,
    author,
    feedUrl,
    lastUpdated,
    isSubscribed: true,
    coverUrl: parseChannelCoverUrl(channel),
    episodes,
  }
}
