import type { Podcast } from "../types/podcast"
import type { Episode, EpisodeType } from "../types/episode"

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

export const parseRSSFeed = (xml: string, feedUrl: string): Podcast & { episodes: Episode[] } => {
  const channel = xml.match(/<channel[\s\S]*?<\/channel>/i)?.[0] ?? xml
  const title = decodeEntities(getTagValue(channel, "title")) || "Untitled Podcast"
  const description = decodeEntities(getTagValue(channel, "description"))
  const author = decodeEntities(getTagValue(channel, "itunes:author"))
  const lastUpdated = new Date()

  const items = channel.match(/<item[\s\S]*?<\/item>/gi) ?? []
  const episodes = items.map((item, index) => {
    const epTitle = decodeEntities(getTagValue(item, "title")) || `Episode ${index + 1}`
    const epDescription = decodeEntities(getTagValue(item, "description"))
    const pubDate = new Date(getTagValue(item, "pubDate") || Date.now())

    // Audio URL + file size + MIME type from <enclosure>
    const enclosure = item.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*>/i)
    const audioUrl = enclosure?.[1] ?? ""
    const fileSizeStr = getAttr(item, "enclosure", "length")
    const fileSize = fileSizeStr ? parseInt(fileSizeStr, 10) : undefined
    const mimeType = getAttr(item, "enclosure", "type") || undefined

    // Duration from <itunes:duration>
    const durationRaw = getTagValue(item, "itunes:duration")
    const duration = parseDuration(durationRaw)

    // Episode & season numbers
    const episodeNumRaw = getTagValue(item, "itunes:episode")
    const episodeNumber = episodeNumRaw ? parseInt(episodeNumRaw, 10) : undefined
    const seasonNumRaw = getTagValue(item, "itunes:season")
    const seasonNumber = seasonNumRaw ? parseInt(seasonNumRaw, 10) : undefined

    // Episode type & explicit
    const episodeType = parseEpisodeType(getTagValue(item, "itunes:episodeType"))
    const explicitRaw = getTagValue(item, "itunes:explicit").toLowerCase()
    const explicit = explicitRaw === "yes" || explicitRaw === "true" ? true : undefined

    // Episode image (itunes:image has href attribute)
    const imageUrl = getAttr(item, "itunes:image", "href") || undefined

    const ep: Episode = {
      id: `${feedUrl}#${index}`,
      podcastId: feedUrl,
      title: epTitle,
      description: epDescription,
      audioUrl,
      duration,
      pubDate,
    }

    // Only set optional fields if present
    if (episodeNumber !== undefined && !isNaN(episodeNumber)) ep.episodeNumber = episodeNumber
    if (seasonNumber !== undefined && !isNaN(seasonNumber)) ep.seasonNumber = seasonNumber
    if (episodeType) ep.episodeType = episodeType
    if (explicit !== undefined) ep.explicit = explicit
    if (imageUrl) ep.imageUrl = imageUrl
    if (fileSize !== undefined && !isNaN(fileSize) && fileSize > 0) ep.fileSize = fileSize
    if (mimeType) ep.mimeType = mimeType

    return ep
  })

  return {
    id: feedUrl,
    title,
    description,
    author,
    feedUrl,
    lastUpdated,
    isSubscribed: true,
    episodes,
  }
}
