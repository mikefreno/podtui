/**
 * Feed-resolution extraction tests.
 *
 * The iTunes Search API returns feedUrl null for shows delisted from Apple
 * Podcasts. Their public Apple page still embeds the real feed URL in JSON
 * state — alongside feedUrls of RELATED shows — so extraction must anchor on
 * the show's adamId rather than grabbing the first feedUrl in the document.
 */
import { test, expect } from "bun:test";
import { extractFeedUrlFromPage } from "../src/utils/itunes-feed-resolver";

const MAIN_FEED = "https://rss.pdrl.fm/b32227/feeds.megaphone.fm/BVDWV5370667266";
const OTHER_FEED = "https://feeds.megaphone.fm/BVDWV7762869899";

/** Synthetic Apple page: related shows first, main showOffer after. */
const pageWithNoise = `{
  "shows":[{"showOffer":{"title":"The Matt Walsh Show","adamId":"2950206264","feedUrl":"${OTHER_FEED}","showType":"episodic"}}],
  "pageData":{"showOffer":{"title":"The Ben Shapiro Show","adamId":"1047335260","feedUrl":"${MAIN_FEED}","showType":"episodic"}}
}`;

test("extracts the show's feed anchored on its adamId, ignoring related shows", () => {
  const feed = extractFeedUrlFromPage(
    pageWithNoise,
    "https://podcasts.apple.com/us/podcast/the-ben-shapiro-show/id1047335260",
  );
  expect(feed).toBe(MAIN_FEED);
});

test("handles the ?uo=4 suffix Apple appends to directory URLs", () => {
  const feed = extractFeedUrlFromPage(
    pageWithNoise,
    "https://podcasts.apple.com/us/podcast/the-ben-shapiro-show/id1047335260?uo=4",
  );
  expect(feed).toBe(MAIN_FEED);
});

test("returns null when the page has no feedUrl for the requested id", () => {
  const feed = extractFeedUrlFromPage(
    pageWithNoise,
    "https://podcasts.apple.com/us/podcast/some-other-show/id9999999999",
  );
  expect(feed).toBeNull();
});

test("finds the feed when the showOffer sits far after the adamId reference", () => {
  // Apple serves page variants where thousands of chars separate the first
  // adamId reference from the showOffer block carrying the feedUrl.
  const variant = `{"adamId":"1047335260","$kind":"ShowPageIntent"}${"x".repeat(6000)}{"showOffer":{"title":"The Ben Shapiro Show","adamId":"1047335260","feedUrl":"${MAIN_FEED}"}}`;
  const feed = extractFeedUrlFromPage(
    variant,
    "https://podcasts.apple.com/us/podcast/the-ben-shapiro-show/id1047335260",
  );
  expect(feed).toBe(MAIN_FEED);
});

test("falls back to the first feedUrl when the URL carries no id", () => {
  const feed = extractFeedUrlFromPage(
    pageWithNoise,
    "https://podcasts.apple.com/us/podcast/the-ben-shapiro-show",
  );
  expect(feed).toBe(OTHER_FEED);
});

test("returns null when the page contains no feedUrl at all", () => {
  const feed = extractFeedUrlFromPage(
    "<html><body>not found</body></html>",
    "https://podcasts.apple.com/us/podcast/the-ben-shapiro-show/id1047335260",
  );
  expect(feed).toBeNull();
});
