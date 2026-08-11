/**
 * Podcast Index fallback tests.
 *
 * The Podcast Index source ships disabled and key-less. It must only be
 * consulted as a low-result fallback (fewer than 3 primary results), only
 * when enabled AND its credentials are stored (hasCredentials), and never
 * twice when also selected as a primary source. Credentials prefer the OS
 * keychain (encrypted at rest); when the keychain is unavailable they fall
 * back to plaintext on the source (config.json). Auth follows the documented
 * scheme: X-Auth-Key, X-Auth-Date (unix epoch), Authorization =
 * sha1(key + secret + date).
 */
import { test, expect, mock, afterEach } from "bun:test";
import { searchPodcasts } from "../src/utils/search";
import {
  searchSourceByType,
  searchEpisodesByType,
  mapPodcastIndexResult,
} from "../src/utils/source-searcher";
import { SourceType } from "../src/types/source";
import type { PodcastSource } from "../src/types/source";

// The searcher pulls credentials from the credential-storage module;
// mock.module is hoisted above the imports, so this stub lands before
// source-searcher loads. resolveSourceCredentials mirrors the real resolver
// (plaintext branch vs keychain branch) against the mutable keychainState.
const keychainState: {
  credentials: { apiKey: string; apiSecret: string } | null;
} = {
  credentials: { apiKey: "TESTKEY123", apiSecret: "TESTSECRET456" },
};

mock.module("../src/utils/source-credentials", () => ({
  savePodcastIndexCredentials: async () => true,
  loadPodcastIndexCredentials: async () => keychainState.credentials,
  resolveSourceCredentials: async (source: PodcastSource) =>
    source.credentialStorage === "plaintext"
      ? source.apiKey && source.apiSecret
        ? { apiKey: source.apiKey, apiSecret: source.apiSecret }
        : null
      : keychainState.credentials,
}));

const sha1 = (input: string): string =>
  Bun.CryptoHasher.hash("sha1", input, "hex") as string;

const itunesSource: PodcastSource = {
  id: "itunes",
  name: "Apple Podcasts",
  type: SourceType.API,
  baseUrl: "https://itunes.apple.com/search",
  enabled: true,
};

const keyedPodcastIndex: PodcastSource = {
  id: "podcastindex",
  name: "Podcast Index",
  type: SourceType.API,
  baseUrl: "https://api.podcastindex.org/api/1.0/search/byterm",
  enabled: true,
  hasCredentials: true,
};

const PI_URL = "https://api.podcastindex.org/api/1.0/search/byterm";
const ITUNES_URL = "https://itunes.apple.com/search";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const itunesResults = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    collectionId: i + 1,
    collectionName: `Show ${i + 1}`,
    feedUrl: `https://example.com/feed${i + 1}.xml`,
  }));

/** Route iTunes vs Podcast Index fetches; records call URLs. */
const routeFetch = (
  calls: string[],
  opts: { itunesCount?: number; piFeeds?: unknown[]; piStatus?: number } = {},
) =>
  mock(async (url: RequestInfo | URL, _init?: RequestInit) => {
    const u = String(url);
    calls.push(u);
    if (u.startsWith(ITUNES_URL)) {
      const count = opts.itunesCount ?? 0;
      return jsonResponse({ resultCount: count, results: itunesResults(count) });
    }
    if (u.startsWith(PI_URL)) {
      if (opts.piStatus && opts.piStatus >= 400) {
        return new Response("nope", { status: opts.piStatus });
      }
      const feeds = opts.piFeeds ?? [];
      return jsonResponse({ status: "true", feeds, count: feeds.length });
    }
    throw new Error(`unexpected fetch: ${u}`);
  }) as unknown as typeof fetch;

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ── result mapping ───────────────────────────────────────────────────────────

test("Podcast Index results map to podcasts with the feed URL direct", () => {
  const mapped = mapPodcastIndexResult(
    {
      id: 42,
      title: "Fallback Show",
      url: "https://example.com/feed2.xml",
      author: "Open Directory",
      image: "https://example.com/art.jpg",
      language: "en",
      episodeCount: 10,
      lastUpdateTime: 1600000000,
      categories: { "104": "Technology", "105": "News" },
    },
    keyedPodcastIndex,
  );
  expect(mapped).not.toBeNull();
  expect(mapped!.id).toBe("podcastindex-42");
  expect(mapped!.title).toBe("Fallback Show");
  // PI is feed-first: the feed URL is present, no delisted-show stub step.
  expect(mapped!.feedUrl).toBe("https://example.com/feed2.xml");
  expect(mapped!.directoryUrl).toBeUndefined();
  expect(mapped!.categories).toEqual(["Technology", "News"]);
  expect(mapped!.lastUpdated.toISOString()).toBe("2020-09-13T12:26:40.000Z");
  expect(mapped!.isSubscribed).toBe(false);
});

test("Podcast Index results without a title or feed URL stay dropped", () => {
  expect(mapPodcastIndexResult({ id: 1 }, keyedPodcastIndex)).toBeNull();
  expect(
    mapPodcastIndexResult({ title: "No Feed" }, keyedPodcastIndex),
  ).toBeNull();
});

// ── auth scheme ──────────────────────────────────────────────────────────────

test("Podcast Index auth uses sha1(key+secret+date) from keychain credentials", async () => {
  let captured: RequestInit | undefined;
  globalThis.fetch = mock(
    async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).startsWith(PI_URL)) {
        captured = init;
        return jsonResponse({
          status: "true",
          feeds: [{ id: 1, title: "X", url: "https://example.com/x.xml" }],
          count: 1,
        });
      }
      return jsonResponse({ resultCount: 0, results: [] });
    },
  ) as unknown as typeof fetch;

  await searchSourceByType("hello", keyedPodcastIndex);

  const headers = captured?.headers as Record<string, string>;
  expect(headers["X-Auth-Key"]).toBe("TESTKEY123");
  expect(headers["User-Agent"]).toBe("PodTUI/1.0");
  expect(headers["X-Auth-Date"]).toMatch(/^\d{10}$/);
  expect(headers["Authorization"]).toBe(
    sha1(`TESTKEY123TESTSECRET456${headers["X-Auth-Date"]}`),
  );
});

test("plaintext-stored credentials drive the search without the keychain", async () => {
  keychainState.credentials = null;
  let captured: RequestInit | undefined;
  globalThis.fetch = mock(
    async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).startsWith(PI_URL)) {
        captured = init;
        return jsonResponse({
          status: "true",
          feeds: [{ id: 1, title: "X", url: "https://example.com/x.xml" }],
          count: 1,
        });
      }
      return jsonResponse({ resultCount: 0, results: [] });
    },
  ) as unknown as typeof fetch;

  const plaintext: PodcastSource = {
    ...keyedPodcastIndex,
    credentialStorage: "plaintext",
    apiKey: "PLAINTEXTKEY",
    apiSecret: "PLAINTEXTSECRET",
  };
  try {
    await searchSourceByType("hello", plaintext);
  } finally {
    keychainState.credentials = {
      apiKey: "TESTKEY123",
      apiSecret: "TESTSECRET456",
    };
  }

  const headers = captured?.headers as Record<string, string>;
  expect(headers["X-Auth-Key"]).toBe("PLAINTEXTKEY");
  expect(headers["Authorization"]).toBe(
    sha1(`PLAINTEXTKEYPLAINTEXTSECRET${headers["X-Auth-Date"]}`),
  );
});

test("missing keychain credentials fail with a setup message, not a request", async () => {
  keychainState.credentials = null;
  const calls: string[] = [];
  globalThis.fetch = routeFetch(calls, { itunesCount: 0 });
  try {
    await expect(searchSourceByType("hello", keyedPodcastIndex)).rejects.toThrow(
      /credentials are missing/,
    );
  } finally {
    keychainState.credentials = {
      apiKey: "TESTKEY123",
      apiSecret: "TESTSECRET456",
    };
  }
  expect(calls).toEqual([]);
});

test("Podcast Index has no episode-scope search backend", async () => {
  const results = await searchEpisodesByType("hello", keyedPodcastIndex);
  expect(results).toEqual([]);
});

// ── fallback behavior ────────────────────────────────────────────────────────

test("thin primary results trigger the keyed Podcast Index fallback", async () => {
  const calls: string[] = [];
  globalThis.fetch = routeFetch(calls, {
    itunesCount: 1,
    piFeeds: [
      { id: 9, title: "Fallback Show", url: "https://example.com/fallback.xml" },
    ],
  });

  const results = await searchPodcasts(
    "unique-query-thin",
    ["itunes"],
    [itunesSource, keyedPodcastIndex],
  );

  expect(calls.some((u) => u.startsWith(PI_URL))).toBe(true);
  const pi = results.find((r) => r.sourceId === "podcastindex");
  expect(pi?.sourceName).toBe("Podcast Index");
  expect(pi?.podcast.title).toBe("Fallback Show");
  expect(results.length).toBe(2);
});

test("fallback is skipped when primary results meet the threshold", async () => {
  const calls: string[] = [];
  globalThis.fetch = routeFetch(calls, { itunesCount: 5 });

  const results = await searchPodcasts(
    "unique-query-full",
    ["itunes"],
    [itunesSource, keyedPodcastIndex],
  );

  expect(calls.some((u) => u.startsWith(PI_URL))).toBe(false);
  expect(results.length).toBe(5);
});

test("a disabled Podcast Index source is never consulted", async () => {
  const calls: string[] = [];
  globalThis.fetch = routeFetch(calls, { itunesCount: 1 });
  const disabled = { ...keyedPodcastIndex, enabled: false };

  await searchPodcasts(
    "unique-query-disabled",
    ["itunes"],
    [itunesSource, disabled],
  );

  expect(calls.some((u) => u.startsWith(PI_URL))).toBe(false);
});

test("a credential-less Podcast Index source never sends requests", async () => {
  const calls: string[] = [];
  globalThis.fetch = routeFetch(calls, { itunesCount: 1 });
  const keyless = { ...keyedPodcastIndex, hasCredentials: false };

  await searchPodcasts(
    "unique-query-keyless",
    ["itunes"],
    [itunesSource, keyless],
  );

  expect(calls.some((u) => u.startsWith(PI_URL))).toBe(false);
});

test("Podcast Index selected as a primary source is fetched once, not twice", async () => {
  const calls: string[] = [];
  globalThis.fetch = routeFetch(calls, {
    itunesCount: 1,
    piFeeds: [
      { id: 9, title: "Fallback Show", url: "https://example.com/fallback.xml" },
    ],
  });

  await searchPodcasts(
    "unique-query-both",
    ["itunes", "podcastindex"],
    [itunesSource, keyedPodcastIndex],
  );

  expect(calls.filter((u) => u.startsWith(PI_URL)).length).toBe(1);
});

test("a failing fallback leaves the primary results intact", async () => {
  const calls: string[] = [];
  globalThis.fetch = routeFetch(calls, { itunesCount: 1, piStatus: 500 });

  const results = await searchPodcasts(
    "unique-query-pi-fail",
    ["itunes"],
    [itunesSource, keyedPodcastIndex],
  );

  expect(results.length).toBe(1);
  expect(results[0].sourceId).toBe("itunes");
});

test("dead Podcast Index feeds are filtered out", async () => {
  const calls: string[] = [];
  globalThis.fetch = routeFetch(calls, {
    itunesCount: 0,
    piFeeds: [
      { id: 1, title: "Live Show", url: "https://example.com/live.xml" },
      {
        id: 2,
        title: "Dead Show",
        url: "https://example.com/dead.xml",
        dead: true,
      },
    ],
  });

  const results = await searchPodcasts(
    "unique-query-dead",
    ["itunes"],
    [itunesSource, keyedPodcastIndex],
  );

  const pi = results.filter((r) => r.sourceId === "podcastindex");
  expect(pi.length).toBe(1);
  expect(pi[0].podcast.title).toBe("Live Show");
});
