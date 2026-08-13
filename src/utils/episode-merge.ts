import type { Episode } from "../types/episode";

/** Sort key for an episode's pubDate — missing/invalid dates sort as NEWEST
 *  (Infinity) so undated episodes float to the top instead of dropping into
 *  the oldest slot. */
const ts = (ep: Episode): number => {
  const t = ep.pubDate?.getTime()
  return t === undefined || Number.isNaN(t) ? Infinity : t
}

/** PubDate stamp for identity matching — undated episodes collapse to a
 *  single token so their twins match by title alone. */
const stamp = (ep: Episode): string => {
  const t = ep.pubDate?.getTime()
  return t === undefined || Number.isNaN(t) ? "undated" : String(t)
}

/**
 * Content signature identifying the SAME episode across id changes. Episode
 * ids are stable (guid / enclosure-URL derived), but a feed can still change
 * an episode's id between refreshes: the one-time migration from the old
 * positional-id scheme, or a host that rotates signed enclosure URLs. title +
 * pubDate is the most stable combination that survives both — a feed
 * re-issuing an episode with the same title and date IS that episode.
 */
export const episodeSignature = (ep: Episode): string =>
  `${ep.title}\u0000${stamp(ep)}`

/**
 * Union of two episode lists keyed by id — on collision the fetched copy
 * wins (fresh metadata). An existing episode whose id differs from every
 * fetched id but whose content signature matches a fetched episode is a
 * stale-id twin (id migration / rotating enclosure URLs) and is dropped,
 * otherwise the union would double every episode on the first refresh after
 * the id scheme changed. Existing episodes with NO fetched twin survive
 * (volatile in-memory window). Result is sorted newest-first by pubDate and
 * pruned by the supplied `keep` predicate: episodes outside the configured
 * cache bound (date window or count) are dropped. Never mutates either
 * input.
 *
 * The caller supplies `keep` so this module stays free of the preference
 * types — the feed store passes a closure bound to the user's mode/count/days.
 */
export function mergeEpisodesBounded(
  existing: Episode[],
  fetched: Episode[],
  keep: (ep: Episode, index: number) => boolean,
): Episode[] {
  const byId = new Map<string, Episode>()
  const bySignature = new Map<string, Episode>()
  for (const ep of fetched) {
    byId.set(ep.id, ep)
    bySignature.set(episodeSignature(ep), ep)
  }
  const merged = [...byId.values()]
  for (const ep of existing) {
    if (byId.has(ep.id)) continue
    if (bySignature.has(episodeSignature(ep))) continue
    merged.push(ep)
  }
  const sorted = merged.sort((a, b) => ts(b) - ts(a))
  return sorted.filter((ep, i) => keep(ep, i))
}
