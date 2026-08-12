/**
 * Global activity indicator — the shared leak-proof activity store
 * (begin/end counter + track helper) and the global top-right overlay that
 * surfaces feed refresh, fetch-more, subscribe fetch, search, and download
 * activity. The download transfer is left in flight on purpose (the test
 * server delays its response) so the "Downloading" state is observable in
 * the captured frame.
 */

import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Point the config/data dirs at throwaway directories BEFORE importing the
// stores (their module-level init reads them) and silence the audio backend.
const configHome = mkdtempSync(join(tmpdir(), "podtui-activity-"));
process.env.XDG_CONFIG_HOME = configHome;
const dataHome = mkdtempSync(join(tmpdir(), "podtui-activity-data-"));
process.env.XDG_DATA_HOME = dataHome;
process.env.PODTUI_AUDIO_BACKEND = "none";

import { testRender } from "@opentui/solid";
import { ThemeProvider } from "../src/context/ThemeContext";
import { GlobalActivityIndicator } from "../src/components/GlobalActivityIndicator";
import { useActivityStore } from "../src/stores/activity";
import { useDownloadStore } from "../src/stores/download";
import type { Episode } from "../src/types/episode";

// The LoadingIndicator glyph cycle.
const SPINNER_RE = /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/;

type Frame = { cols: number; lines: { spans: { text: string }[] }[] };
const frameLines = (f: Frame): string[] =>
	f.lines.map((l) => l.spans.map((s) => s.text).join(""));

function sleep(ms: number): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	setTimeout(resolve, ms);
	return promise;
}

/** Render the indicator in isolation under the dark theme. The ThemeProvider
 *  gates children on async init (capabilities + palette detection, up to
 *  ~1.5s under tmux), so settle frames until the indicator is mounted. */
async function renderIndicator() {
	const setup = await testRender(
		() => (
			<ThemeProvider mode="dark">
				<GlobalActivityIndicator />
			</ThemeProvider>
		),
		{ width: 60, height: 10, useThread: false },
	);
	await setup.renderOnce();
	for (let i = 0; i < 40; i++) {
		await setup.renderOnce();
		await sleep(50);
	}
	return setup;
}

const frameText = (setup: { captureSpans: () => unknown }): string =>
	frameLines(setup.captureSpans() as unknown as Frame).join("\n");

let server: ReturnType<typeof Bun.serve> | null = null;
let audioUrl = "";
/** Response delay (ms) for the next audio request — keeps the transfer in
 *  flight while the "Downloading" state is asserted. */
let audioDelayMs = 0;
/** Episode ids this file started downloads for (shared singleton cleanup). */
const downloadedEpisodeIds: string[] = [];

const makeEpisode = (id: string, title: string): Episode => ({
	id,
	podcastId: "pod",
	title,
	description: "",
	audioUrl,
	duration: 0,
	pubDate: new Date("2026-08-01T00:00:00Z"),
});

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		fetch() {
			const { promise, resolve } = Promise.withResolvers<Response>();
			setTimeout(
				() =>
					resolve(
						new Response("audio bytes", {
							headers: { "Content-Type": "audio/mpeg" },
						}),
					),
				audioDelayMs,
			);
			return promise;
		},
	});
	audioUrl = `http://127.0.0.1:${server!.port}/audio.mp3`;
});

afterAll(async () => {
	const dl = useDownloadStore();
	for (const id of downloadedEpisodeIds) {
		dl.cancelDownload(id);
		await dl.removeDownload(id);
	}
	server?.stop(true);
	rmSync(configHome, { recursive: true, force: true });
	rmSync(dataHome, { recursive: true, force: true });
});

test("beginActivity/end pairs compose: ending one keeps the other active", () => {
	const activity = useActivityStore();
	expect(activity.isActive()).toBe(false);
	expect(activity.labels()).toEqual([]);

	const endFirst = activity.beginActivity("Refreshing");
	const endSecond = activity.beginActivity("Refreshing");
	expect(activity.isActive()).toBe(true);
	expect(activity.labels()).toEqual(["Refreshing", "Refreshing"]);

	endFirst();
	expect(activity.isActive()).toBe(true);
	expect(activity.labels()).toEqual(["Refreshing"]);

	endSecond();
	expect(activity.isActive()).toBe(false);
	expect(activity.labels()).toEqual([]);
});

test("track re-throws rejection and returns isActive() to its prior value", async () => {
	const activity = useActivityStore();
	const prior = activity.isActive();
	await expect(
		activity.track(Promise.reject(new Error("boom")), "Refreshing"),
	).rejects.toThrow("boom");
	expect(activity.isActive()).toBe(prior);
	expect(activity.labels()).toEqual([]);
});

test("idle: renders nothing, no spinner", async () => {
	const setup = await renderIndicator();
	const text = frameText(setup);
	expect(text).not.toMatch(SPINNER_RE);
	expect(text.trim()).toBe("");
	setup.renderer.destroy();
});

test("tracked activity: spinner appears while active, vanishes on end", async () => {
	const activity = useActivityStore();
	const setup = await renderIndicator();
	expect(frameText(setup)).not.toMatch(SPINNER_RE);

	const end = activity.beginActivity("Refreshing");
	await setup.renderOnce();
	const active = frameText(setup);
	expect(active).toMatch(SPINNER_RE);

	end();
	await setup.renderOnce();
	const done = frameText(setup);
	expect(done).not.toMatch(SPINNER_RE);
	expect(done.trim()).toBe("");
	setup.renderer.destroy();
});

test("active download: spinner appears and disappears", async () => {
	const dl = useDownloadStore();
	const setup = await renderIndicator();

	// Keep the transfer in flight while asserting; the response only lands
	// after audioDelayMs, so the download stays DOWNLOADING across renders.
	audioDelayMs = 400;
	const episode = makeEpisode("activity-dl-ep", "DL Ep");
	downloadedEpisodeIds.push(episode.id);
	dl.startDownload(episode, "activity-test-feed");

	await setup.renderOnce();
	const during = frameText(setup);
	expect(during).toMatch(SPINNER_RE);

	// Cancel: the abort settles the fetch and activeCount returns to 0.
	dl.cancelDownload(episode.id);
	for (let i = 0; i < 40; i++) {
		if (dl.getActiveCount() + dl.getQueue().length === 0) break;
		await sleep(25);
	}
	await dl.removeDownload(episode.id);
	await setup.renderOnce();
	const after = frameText(setup);
	expect(dl.getActiveCount() + dl.getQueue().length).toBe(0);
	expect(after).not.toMatch(SPINNER_RE);

	audioDelayMs = 0;
	setup.renderer.destroy();
});
