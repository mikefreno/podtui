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
import { searchSourceByType } from "../src/utils/source-searcher";
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

test("RSS sources return no directory search results", async () => {
  const results = await searchSourceByType("blocked and reported", rssSource);
  expect(results).toEqual([]);
});

test("custom sources return no directory search results", async () => {
  const results = await searchSourceByType("anything", customSource);
  expect(results).toEqual([]);
});
