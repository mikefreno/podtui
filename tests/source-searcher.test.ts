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
import { searchSourceByType, mapItunesResult } from "../src/utils/source-searcher";
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
