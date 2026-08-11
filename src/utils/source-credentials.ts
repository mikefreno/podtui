/**
 * Credential storage for keyed podcast sources.
 *
 * Preferred storage is the macOS keychain (encrypted at rest by the OS),
 * written through the `security` CLI — no native dependencies. When the
 * keychain is unavailable (non-macOS, locked, sandboxed) credentials fall
 * back to plaintext on the source itself (config.json) so the source still
 * works; `credentialStorage` on the source records which backend was used.
 *
 * Credentials are never presented in full — the UI always masks them (first
 * 3 chars + "..."). The keychain password is passed as an argv value to
 * `add-generic-password` (standard practice for CLI-driven keychain writes;
 * the item lands in the login keychain immediately).
 */

import type { PodcastSource } from "../types/source"

const KEYCHAIN_SERVICE = "podtui"
const KEYCHAIN_ACCOUNT = "podcastindex"

export type Credentials = {
  apiKey: string
  apiSecret: string
}

/** Run a `security` subcommand; resolves with exit status + stdout. */
async function runSecurity(
  args: string[],
): Promise<{ ok: boolean; stdout: string }> {
  try {
    const proc = Bun.spawn({
      cmd: ["security", ...args],
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    const exitCode = await proc.exited
    return { ok: exitCode === 0, stdout }
  } catch {
    return { ok: false, stdout: "" }
  }
}

/** Store Podcast Index credentials in the macOS keychain. True on success. */
export async function savePodcastIndexCredentials(
  apiKey: string,
  apiSecret: string,
): Promise<boolean> {
  const payload = JSON.stringify({ apiKey, apiSecret })
  const { ok } = await runSecurity([
    "add-generic-password",
    "-a",
    KEYCHAIN_ACCOUNT,
    "-s",
    KEYCHAIN_SERVICE,
    "-w",
    payload,
    "-U",
  ])
  return ok
}

/** Read Podcast Index credentials from the macOS keychain. Null when absent
 *  or unreadable (non-macOS, item deleted, keychain locked). */
export async function loadPodcastIndexCredentials(): Promise<Credentials | null> {
  const { ok, stdout } = await runSecurity([
    "find-generic-password",
    "-a",
    KEYCHAIN_ACCOUNT,
    "-s",
    KEYCHAIN_SERVICE,
    "-w",
  ])
  if (!ok) return null
  try {
    const parsed = JSON.parse(stdout.trim()) as Credentials
    if (!parsed.apiKey || !parsed.apiSecret) return null
    return parsed
  } catch {
    return null
  }
}

/** Resolve a source's stored credentials: its plaintext fields when saved
 *  with the plaintext fallback, else the macOS keychain. Null when the
 *  source has no usable credentials. */
export async function resolveSourceCredentials(
  source: PodcastSource,
): Promise<Credentials | null> {
  if (source.credentialStorage === "plaintext") {
    return source.apiKey && source.apiSecret
      ? { apiKey: source.apiKey, apiSecret: source.apiSecret }
      : null
  }
  return loadPodcastIndexCredentials()
}
