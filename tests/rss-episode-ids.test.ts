/**
 * Episode id stability regression tests.
 *
 * The parser used to key episodes by their position in the feed
 * (`feedUrl#index`). Any feed change — a new episode published, an old one
 * pruned — shifted every episode's id, so saved progress/downloads attached
 * to whichever episode happened to occupy that index afterward ("start a new
 * episode and it resumes minutes in"). Ids must instead be stable per
 * episode: <guid> when present, else the enclosure URL, else the index.
 */

import { describe, expect, test } from "bun:test"
import { getRSSItems, parseRSSItem } from "../src/api/rss-parser"

const FEED = "https://example.com/feed.xml"

const item = (
  title: string,
  date: string,
  audioUrl: string,
  guid?: string,
): string =>
  `<item>
<title>${title}</title>
<pubDate>${date}</pubDate>
${guid ? `<guid>${guid}</guid>` : ""}
<enclosure url="${audioUrl}" length="12345" type="audio/mpeg"/>
</item>`

const parse = (xml: string): ReturnType<typeof parseRSSItem>[] =>
  getRSSItems(xml).map((it, i) => parseRSSItem(it, FEED, i))

describe("stable episode ids", () => {
  test("guid-based ids survive a new episode being prepended", () => {
    // Two episodes, newest first. Positional ids would be feedUrl#0 / #1.
    const before = parse(
      `<rss><channel>${item("Ep 2", "2026-08-02", "https://cdn.example.com/e2.mp3", "ep-2")}${item("Ep 1", "2026-08-01", "https://cdn.example.com/e1.mp3", "ep-1")}</channel></rss>`,
    )

    // A third, newer episode appears at the top — every index shifts.
    const after = parse(
      `<rss><channel>${item("Ep 3", "2026-08-03", "https://cdn.example.com/e3.mp3", "ep-3")}${item("Ep 2", "2026-08-02", "https://cdn.example.com/e2.mp3", "ep-2")}${item("Ep 1", "2026-08-01", "https://cdn.example.com/e1.mp3", "ep-1")}</channel></rss>`,
    )

    // The known episodes keep their ids — only the newcomer differs.
    expect(after[1].id).toBe(before[0].id) // Ep 2
    expect(after[2].id).toBe(before[1].id) // Ep 1
    expect(after[0].id).not.toBe(before[0].id) // Ep 3 is new
  })

  test("enclosure-URL fallback ids survive reordering (no guid)", () => {
    const a = item("A", "2026-08-02", "https://cdn.example.com/a.mp3")
    const b = item("B", "2026-08-01", "https://cdn.example.com/b.mp3")
    const first = parse(`<rss><channel>${a}${b}</channel></rss>`)
    const reordered = parse(`<rss><channel>${b}${a}</channel></rss>`)

    // The same episodes at different indexes still carry their own ids.
    expect(reordered[0].id).toBe(first[1].id) // B moved to index 0
    expect(reordered[1].id).toBe(first[0].id) // A moved to index 1
  })

  test("ids are namespaced per feed", () => {
    const xml = `<rss><channel>${item("Ep", "2026-08-01", "https://cdn.example.com/e.mp3", "same-guid")}</channel></rss>`
    const parsed = getRSSItems(xml)
    const a = parseRSSItem(parsed[0], "https://a.example/feed.xml", 0)
    const b = parseRSSItem(parsed[0], "https://b.example/feed.xml", 0)
    expect(a.id).not.toBe(b.id)
  })

  test("id is deterministic across parses of the same item", () => {
    const xml = `<rss><channel>${item("Ep", "2026-08-01", "https://cdn.example.com/e.mp3")}</channel></rss>`
    const one = parse(xml)
    const two = parse(xml)
    expect(one[0].id).toBe(two[0].id)
  })
})
