/**
 * FeedPage refresh spinner — while feeds are being fetched (manual `r` and
 * the background refresh timer both route through refreshAllFeeds →
 * isLoadingFeeds), a braille spinner renders at the BOTTOM of the episode
 * list, horizontally centered in the current pane.
 *
 * The refresh is left in flight on purpose (the test server delays its
 * response) so the loading state is visible in the captured frame.
 */

import { test, expect, beforeAll, afterAll } from "bun:test";
import type { Server } from "bun";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Point the config dir at a throwaway directory BEFORE importing the stores
// (their module-level init reads it) and silence the audio backend.
const configHome = mkdtempSync(join(tmpdir(), "podtui-spinner-"));
process.env.XDG_CONFIG_HOME = configHome;
process.env.PODTUI_AUDIO_BACKEND = "none";

import { testRender } from "@opentui/solid";
import { ThemeProvider } from "../src/context/ThemeContext";
import { NavigationProvider } from "../src/context/NavigationContext";
import { FeedPage } from "../src/pages/Feed/FeedPage";
import { useFeedStore } from "../src/stores/feed";
import type { Podcast } from "../src/types/podcast";

// The LoadingIndicator glyph cycle.
const SPINNER_RE = /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/;

type Frame = { cols: number; lines: { spans: { text: string }[] }[] };
const frameLines = (f: Frame): string[] =>
	f.lines.map((l) => l.spans.map((s) => s.text).join(""));

let server: Server<undefined> | null = null;
/** Response delay (ms) for the next fetch — 0 during setup, >0 while the
 *  refresh is in flight so the loading state is observable. */
let delayMs = 0;
let feedUrl = "";
let feedId = "";

/** 3 episodes × 3 rows = 9 list rows: the spinner sits right below them.
 *  Dated inside the lifecycle window (1–3 days ago) so all three render. */
function feedXml(origin: string): string {
	const items = Array.from({ length: 3 }, (_, i) => `<item>
	<title>Spin Ep ${3 - i}</title>
	<pubDate>${new Date(Date.now() - (3 - i) * 24 * 3600 * 1000).toISOString()}</pubDate>
	<enclosure url="${origin}/audio-${i}.mp3" length="12345" type="audio/mpeg"/>
</item>`).join("\n");
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Spinner Show</title>
<description>spinner test feed</description>
${items}
</channel></rss>`;
}

beforeAll(async () => {
	server = Bun.serve({
		port: 0,
		fetch(req) {
			const url = new URL(req.url);
			if (!url.pathname.endsWith(".xml")) {
				return new Response("not found", { status: 404 });
			}
			const { promise, resolve } = Promise.withResolvers<Response>();
			setTimeout(
				() =>
					resolve(
						new Response(feedXml(url.origin), {
							headers: { "Content-Type": "application/rss+xml" },
						}),
					),
				delayMs,
			);
			return promise;
		},
	});
	const podcast: Podcast = {
		id: "",
		title: "Spinner Show",
		description: "spinner test feed",
		author: "tester",
		feedUrl: "",
		lastUpdated: new Date(),
		isSubscribed: true,
	};
	feedUrl = `http://127.0.0.1:${server.port}/spinner.xml`;
	const store = useFeedStore();
	const feed = await store.addFeed(
		{ ...podcast, feedUrl },
		"test-source",
	);
	feedId = feed!.id;
});

afterAll(async () => {
	const store = useFeedStore();
	store.removeFeed(feedId);
	server?.stop(true);
	rmSync(configHome, { recursive: true, force: true });
});

test("refresh spinner renders at the bottom of the list, centered in the current pane", async () => {
	const store = useFeedStore();
	const setup = await testRender(
		() => (
			<ThemeProvider mode="dark">
				<NavigationProvider>
					<FeedPage />
				</NavigationProvider>
			</ThemeProvider>
		),
		{ width: 100, height: 30, useThread: false },
	);

	// Settle until the episode list is mounted.
	let lines: string[] | null = null;
	for (let i = 0; i < 40 && !lines; i++) {
		await setup.renderOnce();
		const ls = frameLines(setup.captureSpans() as unknown as Frame);
		if (ls.some((l) => l.includes("Spin Ep 3"))) lines = ls;
		else await new Promise((r) => setTimeout(r, 50));
	}
	if (!lines) throw new Error("FeedPage did not render episodes before timeout");

	// Kick off a refresh and leave it in flight: isLoadingFeeds flips true
	// synchronously, so the very next frame shows the spinner.
	delayMs = 400;
	const refreshing = store.refreshAllFeeds();
	await setup.renderOnce();
	const loading = frameLines(setup.captureSpans() as unknown as Frame);

	// Locate the spinner row and the current pane's borders ("│" columns;
	// only the current pane is bordered in PaneRow).
	const spinnerRow = loading.findIndex((l) => SPINNER_RE.test(l));
	expect(spinnerRow).toBeGreaterThan(-1);

	const spinnerCol = loading[spinnerRow].search(SPINNER_RE);
	const borderCols = loading
		.map((l, i) => (i <= spinnerRow ? [...l].map((ch, x) => (ch === "│" ? x : -1)) : []))
		.flat()
		.filter((x) => x >= 0);
	const paneLeft = Math.min(...borderCols);
	const paneRight = Math.max(...borderCols);
	const paneCenter = (paneLeft + paneRight) / 2;
	expect(paneLeft).toBeGreaterThan(0); // borders actually found

	// Bottom of the list: below the last episode row.
	const lastEpRow = loading.findLastIndex((l) => l.includes("Spin Ep"));
	expect(spinnerRow).toBeGreaterThan(lastEpRow);

	// Horizontally centered in the current pane (not left-padded).
	expect(Math.abs(spinnerCol - paneCenter)).toBeLessThanOrEqual(8);

	// Let the refresh finish so teardown is clean.
	delayMs = 0;
	await refreshing;
	setup.renderer.destroy();
});
