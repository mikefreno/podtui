/**
 * Feed resolution for an episode. `episode.podcastId` is the RSS feed url
 * (rss-parser), which differs from `podcast.id` (the iTunes directory id) for
 * iTunes-added shows — so a strict `podcast.id` match fails and the feed (and
 * its cover) is never found. Match by podcast id, then feed url, then episode
 * membership, in that order.
 */

import type { Feed } from "../types/feed";
import type { Episode } from "../types/episode";

/** The feed backing `episode`, by podcast id, then feed url, then membership. */
export function feedForEpisode(
	feeds: Feed[],
	episode: Episode,
): Feed | undefined {
	return (
		feeds.find((f) => f.podcast.id === episode.podcastId) ??
		feeds.find((f) => f.podcast.feedUrl === episode.podcastId) ??
		feeds.find((f) => f.episodes.some((e) => e.id === episode.id))
	);
}
