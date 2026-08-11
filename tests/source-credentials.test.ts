/**
 * Credential resolution tests against the real module (no mocks).
 *
 * Only the plaintext branch is exercised: the keychain branch spawns the
 * `security` CLI and would depend on the host machine's keychain state
 * (the keychain-backed pipeline is covered in podcastindex-fallback.test.ts
 * with a stubbed module). The plaintext branch must never touch the
 * keychain — it is the fallback that keeps the source working on machines
 * without a usable macOS keychain.
 */
import { test, expect } from "bun:test";
import { resolveSourceCredentials } from "../src/utils/source-credentials";
import { SourceType } from "../src/types/source";
import type { PodcastSource } from "../src/types/source";

const base: PodcastSource = {
  id: "podcastindex",
  name: "Podcast Index",
  type: SourceType.API,
  baseUrl: "https://api.podcastindex.org/api/1.0/search/byterm",
  enabled: true,
  hasCredentials: true,
};

test("plaintext-storage sources resolve their own fields, no keychain call", async () => {
  const source: PodcastSource = {
    ...base,
    credentialStorage: "plaintext",
    apiKey: "PLAINTEXTKEY",
    apiSecret: "PLAINTEXTSECRET",
  };
  expect(await resolveSourceCredentials(source)).toEqual({
    apiKey: "PLAINTEXTKEY",
    apiSecret: "PLAINTEXTSECRET",
  });
});

test("plaintext-storage sources with empty fields resolve to null", async () => {
  const source: PodcastSource = {
    ...base,
    credentialStorage: "plaintext",
    apiKey: undefined,
    apiSecret: undefined,
  };
  expect(await resolveSourceCredentials(source)).toBeNull();
});
