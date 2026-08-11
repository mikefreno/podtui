/**
 * restore-session.test.ts — "load the last player session at boot" feature.
 *
 * useAudio persists which episode is loaded in the player (on play/load/stop
 * and synchronously at exit), and `restoreLastSession()` reloads it at boot
 * PAUSED at its saved position — never autostarted — skipping episodes at or
 * above 98% completion. The first play action must START the backend (a
 * restored episode was never handed to it), not unpause a dead player.
 *
 * Strategy — the suite shares bun test workers across files, so OTHER test
 * files' `mock.module("../src/hooks/useAudio")` leaks into this file's module
 * registry, and store singletons may already exist. Hence:
 *   - the real useAudio is imported via a `?restore-test` query suffix, which
 *     bun treats as a distinct module identity and loads from disk, bypassing
 *     the suite's useAudio mock (verified: query-suffixed imports are not
 *     intercepted by mock.module);
 *   - feeds are injected through the REAL feed store's public addFeed() API
 *     against a local RSS server (no config seeding — works on whatever
 *     singleton state this worker holds), and progress through update().
 * Audio is the no-op backend via PODTUI_AUDIO_BACKEND=none.
 */
import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── Sandbox BEFORE any app module evaluates ───────────────────────────────
const CONFIG = mkdtempSync(join(tmpdir(), "podtui-restore-"));
const DATA = mkdtempSync(join(tmpdir(), "podtui-restore-data-"));
process.env.XDG_CONFIG_HOME = CONFIG;
process.env.XDG_DATA_HOME = DATA;
process.env.PODTUI_AUDIO_BACKEND = "none";

// ── Local RSS feed server (episode ids = feedUrl#index) ────────────────────
let server: ReturnType<typeof Bun.serve> | null = null;
function feedXml(origin: string): string {
	const items = ["Episode One", "Episode Two"]
		.map(
			(title) => `<item>
	<title>${title}</title>
	<pubDate>2026-08-10T00:00:00Z</pubDate>
	<enclosure url="${origin}/audio.mp3" length="12345" type="audio/mpeg"/>
</item>`,
		)
		.join("\n");
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Restore Test Show</title>
<description>restore-session test feed</description>
${items}
</channel></rss>`;
}

server = Bun.serve({
	port: 0,
	fetch(req) {
		const url = new URL(req.url);
		if (url.pathname.endsWith(".xml")) {
			return new Response(feedXml(url.origin), {
				headers: { "Content-Type": "application/rss+xml" },
			});
		}
		return new Response("not found", { status: 404 });
	},
});

// ── Real modules (loaded after env + server are up) ───────────────────────
// @ts-expect-error — bun-only query suffix: distinct module identity that
// loads the real file instead of a leaked mock.module from another test file.
const { useAudio, restoreLastSession } = await import("../src/hooks/useAudio?restore-test");
const { useFeedStore } = await import("../src/stores/feed");
const { useProgressStore } = await import("../src/stores/progress");
const { saveLastPlayerToFile, waitForLastPlayerWrite } = await import(
	"../src/utils/app-persistence"
);

const feedStore = useFeedStore();
const progressStore = useProgressStore();

// Subscribe to the local feed through the real store API.
const feedUrl = `http://127.0.0.1:${server!.port}/show.xml`;
const feed = await feedStore.addFeed(
	{
		id: feedUrl,
		title: "Restore Test Show",
		description: "restore-session test feed",
		feedUrl,
		lastUpdated: new Date(),
		isSubscribed: true,
	},
	"test-source",
);
if (!feed || feed.episodes.length < 2) {
	throw new Error("test feed did not load two episodes");
}
const ep1 = feed.episodes[0];
const ep2 = feed.episodes[1];

// Simulate a previous session: ep1 loaded, 20% through, marker persisted.
progressStore.update(ep1.id, 120, 600);
saveLastPlayerToFile({ episodeId: ep1.id, timestamp: new Date() });
await waitForLastPlayerWrite();

/** Rewrite the marker as if a previous session had ended this way. */
async function writeMarker(episodeId: string | null): Promise<void> {
	saveLastPlayerToFile({ episodeId, timestamp: new Date() });
	await waitForLastPlayerWrite();
}

/** Read the current last-player marker from disk. */
async function readMarker(): Promise<{ episodeId: string | null } | null> {
	const file = Bun.file(join(CONFIG, "podtui", "last-player.json"));
	if (!(await file.exists())) return null;
	return (await file.json()) as { episodeId: string | null };
}

afterAll(() => {
	server?.stop(true);
	rmSync(CONFIG, { recursive: true, force: true });
	rmSync(DATA, { recursive: true, force: true });
});

// ── Tests ─────────────────────────────────────────────────────────────────

test("restore loads the last player episode paused, without autostart", async () => {
	const audio = useAudio(); // boot trigger also fires restoreLastSession()
	await restoreLastSession();

	expect(audio.currentEpisode()?.id).toBe(ep1.id);
	expect(audio.isPlaying()).toBe(false);
	// Position reflects where playback will resume — the player tab shows it.
	expect(audio.position()).toBe(120);
});

test("first play on a restored episode starts playback from saved progress", async () => {
	const audio = useAudio();
	expect(audio.currentEpisode()?.id).toBe(ep1.id);

	await audio.togglePlayback();

	expect(audio.isPlaying()).toBe(true);
	expect(audio.position()).toBe(120);

	// A second toggle pauses (normal pause path) — no backend restart.
	await audio.togglePlayback();
	expect(audio.isPlaying()).toBe(false);
});

test("restore skips episodes at or above 98% completion", async () => {
	const audio = useAudio();
	await audio.stop(); // clear the previously restored episode
	await waitForLastPlayerWrite(); // stop()'s null marker has landed
	await writeMarker(ep1.id); // stop() cleared the marker; restore needs it

	// Exactly 98% — boundary: NOT restored.
	progressStore.update(ep1.id, 588, 600);
	await restoreLastSession();
	expect(audio.currentEpisode()).toBeNull();

	// Just under 98% — restored.
	progressStore.update(ep1.id, 587, 600);
	await restoreLastSession();
	expect(audio.currentEpisode()?.id).toBe(ep1.id);
	expect(audio.position()).toBe(587);

	await audio.stop();
});

test("restore no-ops when the player was empty at last quit", async () => {
	const audio = useAudio();
	await writeMarker(null);

	await restoreLastSession();
	expect(audio.currentEpisode()).toBeNull();
});

test("restore no-ops when the episode is no longer in any feed", async () => {
	const audio = useAudio();
	await writeMarker("gone-ep");

	await restoreLastSession();
	expect(audio.currentEpisode()).toBeNull();
});

test("play persists the marker; stop clears it", async () => {
	const audio = useAudio();

	await audio.play(ep2);
	await waitForLastPlayerWrite();
	expect((await readMarker())?.episodeId).toBe(ep2.id);

	await audio.stop();
	await waitForLastPlayerWrite();
	expect((await readMarker())?.episodeId).toBeNull();
});
