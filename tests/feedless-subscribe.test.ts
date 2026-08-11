/**
 * End-to-end subscribe test for feedless directory stubs.
 *
 * A delisted show (feedUrl "" + directoryUrl) must resolve its real feed from
 * the directory page inside addFeed — so subscribing just works. When the
 * page can't be resolved, addFeed must refuse (return null) instead of adding
 * a broken feed. Served over a real local HTTP server, mirroring how the
 * app's other store tests exercise the network path.
 */
import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Point the config dir at a throwaway directory BEFORE importing the stores
// (their module-level init reads it).
const configHome = mkdtempSync(join(tmpdir(), "podtui-feedless-"));
process.env.XDG_CONFIG_HOME = configHome;

import { useFeedStore } from "../src/stores/feed";
import type { Podcast } from "../src/types/podcast";

const FEED_ID = "12345";
const EPISODE_TITLES = ["Ep 2", "Ep 1"];

function pageHtml(feedUrl: string): string {
  return `<html><body><script>
{"pageData":{"showOffer":{"title":"Delisted Show","adamId":"${FEED_ID}","feedUrl":"${feedUrl}","showType":"episodic"}}}
</script></body></html>`;
}

function feedXml(origin: string): string {
  const items = EPISODE_TITLES.map(
    (title, i) => `<item>
<title>${title}</title>
<pubDate>2026-08-0${2 - i}T00:00:00Z</pubDate>
<enclosure url="${origin}/audio-${i}.mp3" length="12345" type="audio/mpeg"/>
</item>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Delisted Show</title>
<description>Feedless stub test</description>
${items}
</channel></rss>`;
}

let server: ReturnType<typeof Bun.serve> | null = null;
let feedUrl = "";
let pageUrl = "";

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname.endsWith(".rss")) {
        return new Response(feedXml(url.origin), {
          headers: { "Content-Type": "application/rss+xml" },
        });
      }
      if (url.pathname.startsWith("/show")) {
        return new Response(pageHtml(feedUrl), {
          headers: { "Content-Type": "text/html" },
        });
      }
      return new Response("not found", { status: 404 });
    },
  });
  feedUrl = `http://127.0.0.1:${server!.port}/feed.rss`;
  // The resolver anchors on `/id<digits>` in the directory URL.
  pageUrl = `http://127.0.0.1:${server!.port}/show/id${FEED_ID}`;
});

afterAll(() => {
  server?.stop(true);
  rmSync(configHome, { recursive: true, force: true });
});

const makeStub = (feedUrl: string, directoryUrl?: string): Podcast => ({
  id: "itunes-12345",
  title: "Delisted Show",
  description: "Show that left the directory",
  author: "Some Network",
  feedUrl,
  directoryUrl,
  lastUpdated: new Date(),
  isSubscribed: false,
});

test("addFeed resolves a feedless stub's feed from its directory page", async () => {
  const store = useFeedStore();
  const feed = await store.addFeed(makeStub("", pageUrl), "itunes");
  expect(feed).not.toBeNull();
  expect(feed!.podcast.feedUrl).toBe(feedUrl);
  // Resolution metadata is dropped from the persisted feed record.
  expect(feed!.podcast.directoryUrl).toBeUndefined();
  expect(feed!.episodes.map((e) => e.title)).toEqual(EPISODE_TITLES);
  // Remove the feed: bun test shares the store singleton across files, and a
  // leftover feed (whose server dies in afterAll) would reorder other files'
  // refresh assertions.
  store.removeFeed(feed!.id);
});

test("addFeed refuses a stub whose directory page cannot be resolved", async () => {
  const store = useFeedStore();
  const unreachable = makeStub("", "http://127.0.0.1:1/nope/id999");
  const feed = await store.addFeed(unreachable, "itunes");
  expect(feed).toBeNull();
});

test("addFeed refuses a stub with no directory page at all", async () => {
  const store = useFeedStore();
  const bare = makeStub("", undefined);
  const feed = await store.addFeed(bare, "itunes");
  expect(feed).toBeNull();
});
