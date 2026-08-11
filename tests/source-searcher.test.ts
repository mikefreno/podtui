/**
 * Search source dispatch regression test.
 *
 * RSS-type and custom sources have no directory search backend: a feed URL
 * identifies one show, and no API exists to search "the RSS directory". They
 * must return no results. Earlier the dispatcher fabricated fake podcasts
 * ("<query> Daily Briefing" by "<Source> Network", with dead
 * https://example.com/... feed URLs) from the query, which polluted every
 * search. This test pins the empty-result contract.
 */
import { test, expect } from "bun:test";
import {
  searchSourceByType,
  searchEpisodesByType,
  mapItunesResult,
  mapItunesEpisodeResult,
} from "../src/utils/source-searcher";
import { SourceType } from "../src/types/source";
import type { PodcastSource } from "../src/types/source";

const rssSource: PodcastSource = {
  id: "rss",
  name: "RSS Feed",
  type: SourceType.RSS,
  baseUrl: "",
  enabled: true,
};

const customSource: PodcastSource = {
  id: "my-feed",
  name: "My Feed",
  type: SourceType.CUSTOM,
  baseUrl: "https://example.com/feed.rss",
  enabled: true,
};

const itunesSource: PodcastSource = {
  id: "itunes",
  name: "Apple Podcasts",
  type: SourceType.API,
  baseUrl: "https://itunes.apple.com/search",
  enabled: true,
  country: "US",
  language: "en_us",
};

test("RSS sources return no directory search results", async () => {
  const results = await searchSourceByType("blocked and reported", rssSource);
  expect(results).toEqual([]);
});

test("custom sources return no directory search results", async () => {
  const results = await searchSourceByType("anything", customSource);
  expect(results).toEqual([]);
});

// ── iTunes stub records (delisted shows) ────────────────────────────────────
// Shows that left Apple Podcasts (e.g. The Daily Wire's in 2021) remain in
// the directory as metadata-only records with feedUrl null. They must stay
// findable — earlier they were dropped entirely, so "ben shapiro" surfaced
// nothing while the show is the #1 iTunes hit.

test("iTunes results without a feedUrl (delisted shows) are kept, not dropped", () => {
  const stub = mapItunesResult(
    {
      collectionId: 1047335260,
      collectionName: "The Ben Shapiro Show",
      artistName: "The Daily Wire",
      feedUrl: null,
      collectionViewUrl:
        "https://podcasts.apple.com/us/podcast/the-ben-shapiro-show/id1047335260",
    },
    itunesSource,
  );
  expect(stub).not.toBeNull();
  expect(stub!.title).toBe("The Ben Shapiro Show");
  // Empty feed marks "unavailable from this directory"; the Apple page URL
  // is carried for feed resolution at subscribe time.
  expect(stub!.feedUrl).toBe("");
  expect(stub!.directoryUrl).toBe(
    "https://podcasts.apple.com/us/podcast/the-ben-shapiro-show/id1047335260",
  );
});

test("iTunes results with a feedUrl keep it and carry no directory fallback", () => {
  const normal = mapItunesResult(
    {
      collectionId: 1487234816,
      collectionName: "Morning Wire",
      artistName: "The Daily Wire",
      feedUrl: "https://feeds.megaphone.fm/BVDWV8747925072",
    },
    itunesSource,
  );
  expect(normal).not.toBeNull();
  expect(normal!.feedUrl).toBe("https://feeds.megaphone.fm/BVDWV8747925072");
  expect(normal!.directoryUrl).toBeUndefined();
});

test("iTunes results without a collection name stay dropped", () => {
  const dropped = mapItunesResult(
    { collectionId: 1, feedUrl: "https://example.com/feed.xml" },
    itunesSource,
  );
  expect(dropped).toBeNull();
});

// ── Episode search (entity=podcastEpisode) ──────────────────────────────────
// Episode scope lets a query find a specific episode — e.g. a guest appearing
// across shows — instead of only whole shows.

test("episode results map to an episode plus its parent show", () => {
  const mapped = mapItunesEpisodeResult(
    {
      trackId: 1000000000001,
      trackName: "Sam Altman on AGI, energy, and the future of work",
      collectionId: 1434243584,
      collectionName: "Lex Fridman Podcast",
      artistName: "Lex Fridman",
      description: "Sam Altman joins the show to talk about AGI.",
      feedUrl: "https://lexfridman.com/feed/podcast",
      episodeUrl: "https://lexfridman.com/audio/ep-434.mp3",
      trackTimeMillis: 3600000,
      releaseDate: "2025-02-01T08:00:00Z",
      artworkUrl600: "https://example.com/art600.jpg",
      primaryGenreName: "Technology",
    },
    itunesSource,
  );
  expect(mapped).not.toBeNull();
  const { podcast, episode } = mapped!;

  // Episode fields: id namespaced, duration ms → seconds, date parsed.
  expect(episode.id).toBe("itunes-ep-1000000000001");
  expect(episode.podcastId).toBe(podcast.id);
  expect(episode.title).toBe("Sam Altman on AGI, energy, and the future of work");
  expect(episode.audioUrl).toBe("https://lexfridman.com/audio/ep-434.mp3");
  expect(episode.duration).toBe(3600);
  expect(episode.pubDate.toISOString()).toBe("2025-02-01T08:00:00.000Z");

  // Parent show carries the feed for subscribing, like a show result.
  expect(podcast.title).toBe("Lex Fridman Podcast");
  expect(podcast.id).toBe("itunes-1434243584");
  expect(podcast.feedUrl).toBe("https://lexfridman.com/feed/podcast");
  expect(podcast.isSubscribed).toBe(false);
});

test("episode results strip HTML from descriptions", () => {
  const mapped = mapItunesEpisodeResult(
    {
      trackName: "Episode with HTML notes",
      collectionName: "Some Show",
      description: "<p>Guest: <strong>Jane Doe</strong></p><p>Topic: AI.</p>",
      feedUrl: "https://example.com/feed.xml",
    },
    itunesSource,
  );
  expect(mapped).not.toBeNull();
  const desc = mapped!.episode.description;
  expect(desc).toContain("Jane Doe");
  expect(desc).not.toContain("<");
  expect(desc).not.toContain(">");
});

test("episode results without a track name stay dropped", () => {
  const dropped = mapItunesEpisodeResult(
    { collectionId: 1, collectionName: "Some Show" },
    itunesSource,
  );
  expect(dropped).toBeNull();
});

test("episode results without a collection name stay dropped", () => {
  const dropped = mapItunesEpisodeResult(
    { trackId: 1, trackName: "Some Episode" },
    itunesSource,
  );
  expect(dropped).toBeNull();
});

test("episode results of delisted shows keep a directory fallback on the show", () => {
  const mapped = mapItunesEpisodeResult(
    {
      trackId: 2,
      trackName: "An episode",
      collectionId: 1047335260,
      collectionName: "The Ben Shapiro Show",
      artistName: "The Daily Wire",
      feedUrl: null,
      collectionViewUrl:
        "https://podcasts.apple.com/us/podcast/the-ben-shapiro-show/id1047335260",
    },
    itunesSource,
  );
  expect(mapped).not.toBeNull();
  expect(mapped!.podcast.feedUrl).toBe("");
  expect(mapped!.podcast.directoryUrl).toBe(
    "https://podcasts.apple.com/us/podcast/the-ben-shapiro-show/id1047335260",
  );
});

test("RSS and custom sources return no episode search results either", async () => {
  expect(await searchEpisodesByType("sam altman", rssSource)).toEqual([]);
  expect(await searchEpisodesByType("sam altman", customSource)).toEqual([]);
});
