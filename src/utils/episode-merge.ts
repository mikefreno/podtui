import type { Episode } from "../types/episode"

/** Sort key for an episode's pubDate — missing/invalid dates sort as NEWEST
 *  (Infinity) so undated episodes float to the top instead of dropping into
 *  the oldest slot. */
const ts = (ep: Episode): number => {
  const t = ep.pubDate?.getTime()
  return t === undefined || Number.isNaN(t) ? Infinity : t
}

/**
 * Union of two episode lists keyed by id — on collision the fetched copy
 * wins (fresh metadata). Result is sorted newest-first by pubDate and capped
 * at `cap` entries (oldest dropped). Never mutates either input.
 */
export function mergeEpisodes(
  existing: Episode[],
  fetched: Episode[],
  cap: number,
): Episode[] {
  const byId = new Map<string, Episode>()
  for (const ep of existing) byId.set(ep.id, ep)
  for (const ep of fetched) byId.set(ep.id, ep)
  const sorted = [...byId.values()].sort((a, b) => ts(b) - ts(a))
  return sorted.slice(0, cap)
}
