import type { Podcast } from "../types/podcast"
import type { Episode } from "../types/episode"

const getTagValue = (xml: string, tag: string): string => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\s\S]*?)</${tag}>`, "i"))
  return match?.[1]?.trim() ?? ""
}

const decodeEntities = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

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
    const enclosure = item.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*>/i)
    const audioUrl = enclosure?.[1] ?? ""

    return {
      id: `${feedUrl}#${index}`,
      podcastId: feedUrl,
      title: epTitle,
      description: epDescription,
      audioUrl,
      duration: 0,
      pubDate,
    }
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
