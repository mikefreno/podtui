/**
 * Unit test for feedForEpisode: resolving the feed behind an episode.
 *
 * The critical case is the reported regression — an iTunes show's episode has
 * `podcastId` set to the RSS feed url (rss-parser:163) while the feed's
 * `podcast.id` is the iTunes directory id. Those differ, so a strict
 * `podcast.id` match loses the feed (and its cover, stalling Now Playing art).
 */

import { describe, expect, test } from "bun:test";
import { feedForEpisode } from "../src/utils/feed-resolve";
import { FeedVisibility } from "../src/types/feed";
import type { Episode } from "../src/types/episode";
import type { Feed } from "../src/types/feed";

function makeFeed(id: string, feedUrl: string, title = `Show ${id}`): Feed {
	return {
		id,
		podcast: {
			id,
			title,
			description: "",
			feedUrl,
			coverUrl: `https://cover/${id}.jpg`,
			lastUpdated: new Date(),
			isSubscribed: true,
		},
		episodes: [],
		visibility: FeedVisibility.PUBLIC,
		sourceId: "test",
		lastUpdated: new Date(),
		isPinned: false,
	};
}

const episode = (podcastId: string, id = "ep"): Episode => ({
	id,
	podcastId,
	title: "Episode",
	description: "",
	audioUrl: "https://audio/ep.mp3",
	duration: 60,
	pubDate: new Date(),
});

describe("feedForEpisode", () => {
	test("matches when episode.podcastId equals the feed's podcast.id", () => {
		const f = makeFeed("id-a", "http://a/feed.xml");
		expect(feedForEpisode([f], episode("id-a"))?.podcast.id).toBe("id-a");
	});

	test("matches an iTunes show by feed url (podcastId != podcast.id)", () => {
		// The regression: feed.podcast.id is the directory id, podcastId the
		// RSS url — a strict id match loses the feed.
		const feedUrl = "http://itunes.example/feed.xml";
		const f = makeFeed("itunes-1177068388", feedUrl);
		const got = feedForEpisode([f], episode(feedUrl));
		expect(got?.podcast.id).toBe("itunes-1177068388");
	});

	test("falls back to episode membership when neither id nor feedUrl match", () => {
		const f = makeFeed("id-b", "http://b/feed.xml");
		const ep = episode("unrelated", "ep-42");
		f.episodes = [ep];
		expect(feedForEpisode([f], ep)?.podcast.id).toBe("id-b");
	});

	test("returns undefined when no feed matches", () => {
		const f = makeFeed("id-c", "http://c/feed.xml");
		expect(feedForEpisode([f], episode("nowhere"))).toBeUndefined();
	});
});
