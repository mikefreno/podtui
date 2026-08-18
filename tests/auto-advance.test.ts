/**
 * auto-advance.test.ts — "at the end of episodes play the next one, from
 * the source that started it" feature.
 *
 * When a track reaches its natural end (mpv eof-reached), useAudio must
 * advance to the next episode in the source queue — the current show's
 * episode list (MY_SHOWS), the Feed's chronological list, or the search
 * results — and must STOP at the end of the list (no wrap-around). A
 * crashed/killed daemon must NOT auto-advance (that path is pinned by
 * external-pause-reconcile.test.ts).
 *
 * Integration style (like external-pause-reconcile.test.ts): real stores,
 * real persistence sandbox, and the REAL mpv backend driven by real audio
 * files — two short local WAVs served over HTTP, so EOF happens on a
 * deterministic timer. The show is subscribed through the real feed store's
 * addFeed() API (no config seeding — works on whatever singleton state this
 * worker holds), and the audio-nav source is pinned to MY_SHOWS for that
 * podcast so the queue is scoped and deterministic. Skipped when mpv isn't
 * installed.
 */
import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const hasMpv = !!Bun.which("mpv");

// ── Sandbox BEFORE any app module evaluates ───────────────────────────────
const CONFIG = mkdtempSync(join(tmpdir(), "podtui-autoadv-"));
const DATA = mkdtempSync(join(tmpdir(), "podtui-autoadv-data-"));
process.env.XDG_CONFIG_HOME = CONFIG;
process.env.XDG_DATA_HOME = DATA;
process.env.PODTUI_AUDIO_BACKEND = "mpv"; // real backend; EOF is the signal under test

/** 2s mono 16-bit WAV with a sine tone — short enough to EOF fast,
 *  distinct per episode so playback is unambiguous. */
function makeWav(freq: number): Buffer {
	const SAMPLE_RATE = 44100;
	const DURATION = 2;
	const dataLen = SAMPLE_RATE * DURATION;
	const buf = Buffer.alloc(44 + dataLen * 2);
	buf.write("RIFF", 0);
	buf.writeUInt32LE(36 + dataLen * 2, 4);
	buf.write("WAVE", 8);
	buf.write("fmt ", 12);
	buf.writeUInt32LE(16, 16); // fmt chunk size
	buf.writeUInt16LE(1, 20); // PCM
	buf.writeUInt16LE(1, 22); // mono
	buf.writeUInt32LE(SAMPLE_RATE, 24);
	buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
	buf.writeUInt16LE(2, 32); // block align
	buf.writeUInt16LE(16, 34); // bits per sample
	buf.write("data", 36);
	buf.writeUInt32LE(dataLen * 2, 40);
	for (let i = 0; i < dataLen; i++) {
		const sample = Math.round(
			Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE) * 8000,
		);
		buf.writeInt16LE(sample, 44 + i * 2);
	}
	return buf;
}
const wav1 = makeWav(440);
const wav2 = makeWav(880);

// ── Local HTTP server: the RSS feed + both audio files ────────────────────
let server: ReturnType<typeof Bun.serve> | null = null;
function feedXml(origin: string): string {
	// Distinct pubDates so ep1 (newest) is episodes[0], ep2 older — "next"
	// must step DOWN the list toward the older episode.
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Auto Advance Show</title>
<description>auto-advance test feed</description>
<item>
<title>Episode One</title>
<pubDate>2026-08-10T00:00:00Z</pubDate>
<enclosure url="${origin}/e1.wav" length="${wav1.length}" type="audio/wav"/>
</item>
<item>
<title>Episode Two</title>
<pubDate>2026-08-01T00:00:00Z</pubDate>
<enclosure url="${origin}/e2.wav" length="${wav2.length}" type="audio/wav"/>
</item>
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
		if (url.pathname.endsWith("e1.wav")) {
			return new Response(wav1.buffer as ArrayBuffer, {
				headers: { "Content-Type": "audio/wav" },
			});
		}
		if (url.pathname.endsWith("e2.wav")) {
			return new Response(wav2.buffer as ArrayBuffer, {
				headers: { "Content-Type": "audio/wav" },
			});
		}
		return new Response("not found", { status: 404 });
	},
});

// ── Real modules (loaded after env + server are up) ───────────────────────
// @ts-expect-error — bun-only query suffix: distinct module identity that
// loads the real file instead of a leaked mock.module from another test file.
const { useAudio } = await import("../src/hooks/useAudio?auto-advance-test");
const { useFeedStore } = await import("../src/stores/feed");
const { useAudioNavStore, AudioSource } = await import(
	"../src/stores/audio-nav"
);

const feedStore = useFeedStore();
const audioNav = useAudioNavStore();

/** Poll `check` every 25ms until truthy; throw after `timeoutMs`. */
async function waitFor(
	check: () => boolean,
	timeoutMs = 15000,
): Promise<void> {
	const start = Date.now();
	while (!check()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error("condition not met in time");
		}
		await Bun.sleep(25);
	}
}

// Subscribe to the local feed through the real store API; unique podcast id
// so the MY_SHOWS queue lookup is deterministic whatever else this worker's
// shared feed store holds.
const feedUrl = `http://127.0.0.1:${server!.port}/show.xml`;
const PODCAST_ID = `auto-advance-pod-${process.pid}`;
const feed = await feedStore.addFeed(
	{
		id: PODCAST_ID,
		title: "Auto Advance Show",
		description: "auto-advance test feed",
		feedUrl,
		lastUpdated: new Date(),
		isSubscribed: true,
	},
	"test-source",
);
if (!feed || feed.episodes.length < 2) {
	throw new Error("test feed did not load two episodes");
}
const ep1 = feed.episodes[0]; // newest — plays first
const ep2 = feed.episodes[1]; // older — must follow automatically
if (ep1.title !== "Episode One") {
	throw new Error("episode order unexpected — ep1 is not the newest");
}

afterAll(() => {
	audioNav.reset(); // don't leak nav state into shared-worker tests
	server?.stop(true);
	rmSync(CONFIG, { recursive: true, force: true });
	rmSync(DATA, { recursive: true, force: true });
});

test.skipIf(!hasMpv)(
	"episode ending auto-plays the next in the show; the last episode stops",
	async () => {
		const audio = useAudio();
		audioNav.setSource(AudioSource.MY_SHOWS, PODCAST_ID);

		// Start the newest episode.
		await audio.play(ep1);
		expect(audio.isPlaying()).toBe(true);
		expect(audio.currentEpisode()?.id).toBe(ep1.id);

		// EOF → the next (older) episode starts automatically, and the nav
		// index moves with it.
		await waitFor(
			() =>
				audio.currentEpisode()?.id === ep2.id && audio.isPlaying(),
		);
		expect(audioNav.getCurrentIndex()).toBe(1);

		// The last episode ends → playback stops; no wrap-around to ep1.
		await waitFor(() => !audio.isPlaying());
		expect(audio.currentEpisode()?.id).toBe(ep2.id);
		await Bun.sleep(600); // give any (wrong) auto-advance time to fire
		expect(audio.currentEpisode()?.id).toBe(ep2.id);
		expect(audio.isPlaying()).toBe(false);

		await audio.stop();
	},
	{ timeout: 45000 },
);
