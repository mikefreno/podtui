/**
 * search-episode-actions.test.tsx — episode search results must stream
 * directly, subscribed or not, and `a` must subscribe an unsubscribed show
 * in place.
 *
 * Regression: `enter` on an unsubscribed show's episode result used to
 * subscribe instead of play — there was no direct "stream unsubscribed
 * episode" path (subscribing first was the only way to hear it). `enter` now
 * plays every episode result (matching Feed/My Shows), and the new `subscribe`
 * action (`a`, sibling of `x` unsubscribe) subscribes the focused result.
 *
 * Mounts the real app (sandboxed, silent audio, mocked search store) and
 * drives the Search tab with the test renderer's mock keys: enter on an
 * unsubscribed episode plays it without subscribing; `a` subscribes (feed
 * fetched from a local server); enter then plays the now-subscribed episode.
 * The search store is mocked so results are deterministic (no directory
 * network calls); the feed store is real and served from a local HTTP server.
 *
 * App modules are loaded dynamically (never statically) because the sandbox
 * config/data dirs must be set BEFORE they evaluate — their module-level init
 * reads those env vars at import time.
 */

import { test, expect, afterAll, beforeAll, mock } from "bun:test";
import type { Server } from "bun";
import { testRender } from "@opentui/solid";
import { createSignal } from "solid-js";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { AudioControls } from "../src/hooks/useAudio";
import type { SearchResult, SearchScope } from "../src/types/source";
import type { Episode } from "../src/types/episode";
import type { Podcast } from "../src/types/podcast";
import type { DepthFrame, NavigationState } from "../src/context/navigation-store";

// Recording audio stub: `play` pushes what was streamed. Registered FIRST so
// a leaked partial useAudio mock from another file in this worker can't break
// the app mount (see tests/search-focus.test.tsx for the same hazard).
const played: Episode[] = [];
const stubAudio: AudioControls = {
	isPlaying: () => false,
	position: () => 0,
	duration: () => 0,
	volume: () => 1,
	speed: () => 1,
	backendName: () => "none",
	error: () => null,
	currentEpisode: () => null,
	availablePlayers: () => [],
	play: async (episode: Episode) => {
		played.push(episode);
	},
	load: async () => {},
	pause: async () => {},
	resume: async () => {},
	togglePlayback: async () => {},
	stop: async () => {},
	seek: async () => {},
	seekRelative: async () => {},
	setVolume: async () => {},
	setSpeed: async () => {},
	switchBackend: async () => {},
	prev: async () => {},
	next: async () => {},
};
mock.module("../src/hooks/useAudio", () => ({
	useAudio: () => stubAudio,
}));

// Deterministic search store: `search` feeds the seeded results synchronously;
// markSubscribed/markUnsubscribed flip the result's flag (SearchPage renders
// it, and the real feed store still owns the actual subscription).
const [scope, setScope] = createSignal<SearchScope>("episode");
const [results, setResults] = createSignal<SearchResult[]>([]);
const [query, setQuery] = createSignal("");
const [isSearching, setIsSearching] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);
const [history, setHistory] = createSignal<string[]>([]);
const flip = (id: string, feedUrl: string | undefined, subscribed: boolean) =>
	setResults((prev) =>
		prev.map((r) =>
			r.podcast.id === id ||
			(feedUrl && r.podcast.feedUrl === feedUrl)
				? { ...r, podcast: { ...r.podcast, isSubscribed: subscribed } }
				: r,
		),
	);
const mockSearchStore = {
	query,
	isSearching,
	results,
	error,
	history,
	selectedSources: () => [] as string[],
	scope,
	search: async () => {},
	setQuery,
	clearResults: () => setResults([]),
	clearHistory: () => setHistory([]),
	removeFromHistory: () => {},
	setSelectedSources: () => {},
	setScope,
	markSubscribed: (id: string, feedUrl?: string) => flip(id, feedUrl, true),
	markUnsubscribed: (id: string, feedUrl?: string) => flip(id, feedUrl, false),
};
mock.module("../src/stores/search", () => ({
	useSearchStore: () => mockSearchStore,
}));

// Sandbox BEFORE any app module evaluates — config-dir/persistence read these
// env vars at import time, so the app modules are loaded dynamically.
const SANDBOX = join(process.cwd(), ".harness", "test-episode-actions");
mkdirSync(join(SANDBOX, "config-home"), { recursive: true });
mkdirSync(join(SANDBOX, "data-home"), { recursive: true });
process.env.XDG_CONFIG_HOME = join(SANDBOX, "config-home");
process.env.XDG_DATA_HOME = join(SANDBOX, "data-home");
process.env.PODTUI_AUDIO_BACKEND = "none";

const { App } = await import("../src/App");
const { ThemeProvider } = await import("../src/context/ThemeContext");
const toast = await import("../src/ui/toast");
const { KeybindProvider, useKeybinds } = await import(
	"../src/context/KeybindContext"
);
const { NavigationProvider, useNavigation } = await import(
	"../src/context/NavigationContext"
);
const { DialogProvider } = await import("../src/ui/dialog");
const { CommandProvider } = await import("../src/ui/command");
const { TABS } = await import("../src/utils/navigation");
const { useFeedStore } = await import("../src/stores/feed");

// Local HTTP server serving one show's RSS feed (the feed store fetches it
// when subscribing).
let server: Server<unknown> | null = null;
let feedUrl = "";
let audioUrl = "";

function feedXml(origin: string): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Stream Me Show</title>
<description>Test feed</description>
<item>
<title>Ep 1</title>
<pubDate>2026-08-01T00:00:00Z</pubDate>
<enclosure url="${origin}/audio.mp3" length="12345" type="audio/mpeg"/>
</item>
</channel></rss>`;
}

function makeResult(): SearchResult {
	const episode: Episode = {
		id: "stream-ep-1",
		podcastId: "dir-stream-me",
		title: "Ep 1",
		description: "",
		audioUrl,
		duration: 0,
		pubDate: new Date("2026-08-01T00:00:00Z"),
	};
	const podcast: Podcast = {
		id: "dir-stream-me",
		title: "Stream Me Show",
		description: "Test feed",
		author: "tester",
		feedUrl,
		lastUpdated: new Date(),
		isSubscribed: false,
	};
	return {
		kind: "episode",
		sourceId: "test",
		sourceName: "Test",
		podcast,
		episode,
	};
}

type MockInput = { pressKey: (key: string) => void; pressEnter: () => void };
type Mounted = {
	renderer: { destroy: () => void };
	renderOnce: () => Promise<void>;
	mockInput: MockInput;
	nav: () => NavigationState;
	keybindsReady: () => boolean;
};

async function mountApp(): Promise<Mounted> {
	let navRef: NavigationState | null = null;
	let keybindsRef: { ready: boolean } | null = null;
	const StateProbe = () => {
		navRef = useNavigation();
		keybindsRef = useKeybinds();
		return null;
	};
	const HarnessRoot = () => (
		<toast.ToastProvider>
			<ThemeProvider mode="dark">
				<KeybindProvider>
					<NavigationProvider>
						<StateProbe />
						<DialogProvider>
							<CommandProvider>
								<App />
								<toast.Toast />
							</CommandProvider>
						</DialogProvider>
					</NavigationProvider>
				</KeybindProvider>
			</ThemeProvider>
		</toast.ToastProvider>
	);
	const setup = await testRender(() => <HarnessRoot />, {
		width: 100,
		height: 30,
		useThread: false,
	});
	// The test renderer intercepts stdout; the app is a TUI that writes frames
	// asynchronously, so silence that interception (same as search-focus).
	(
		setup.renderer as unknown as {
			disableStdoutInterception?: () => void;
		}
	).disableStdoutInterception?.();
	await setup.renderOnce();
	await sleep(60);
	return {
		renderer: setup.renderer,
		renderOnce: setup.renderOnce,
		mockInput: setup.mockInput,
		nav: () => navRef!,
		keybindsReady: () => keybindsRef?.ready ?? false,
	};
}

function sleep(ms: number): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	setTimeout(resolve, ms);
	return promise;
}

async function settleReady(m: Mounted): Promise<void> {
	for (let i = 0; i < 80; i++) {
		await m.renderOnce();
		await sleep(60);
		if (m.keybindsReady()) return;
	}
	throw new Error("keybinds never became ready");
}

async function waitFor(
	m: Mounted,
	cond: () => boolean,
	what: string,
	timeoutMs = 5000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (cond()) return;
		await m.renderOnce();
		await sleep(25);
	}
	throw new Error(`timed out waiting for: ${what}`);
}

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		fetch(req) {
			const url = new URL(req.url);
			if (url.pathname.endsWith(".xml")) {
				return new Response(feedXml(url.origin), {
					headers: { "Content-Type": "application/rss+xml" },
				});
			}
			return new Response("audio bytes", {
				headers: { "Content-Type": "audio/mpeg" },
			});
		},
	});
	feedUrl = `http://127.0.0.1:${server!.port}/show.xml`;
	audioUrl = `http://127.0.0.1:${server!.port}/audio.mp3`;
});

afterAll(() => {
	server?.stop(true);
	rmSync(SANDBOX, { recursive: true, force: true });
});

test("enter streams an unsubscribed show's episode; a subscribes it in place; enter then still plays", async () => {
	const m = await mountApp();
	try {
		await settleReady(m);

		// Open the Search tab (digit press retried until the router attaches).
		for (let i = 0; i < 20 && m.nav().activeTab() !== TABS.SEARCH; i++) {
			m.mockInput.pressKey("4");
			await m.renderOnce();
			await sleep(40);
		}
		expect(m.nav().activeTab()).toBe(TABS.SEARCH);
		m.mockInput.pressEnter(); // open the tab's content (query depth)
		await waitFor(m, () => m.nav().inputFocused(), "search tab mounted");

		// Seed one unsubscribed-show episode result and drill to results
		// (mirrors SearchPage.runSearch: set results, push the frame).
		setResults([makeResult()]);
		const frame: DepthFrame = { kind: "search:results", ctx: "test", focus: 0 };
		m.nav().pushDepth(frame);
		m.nav().setActivePane(1);
		await waitFor(m, () => m.nav().currentDepth() === 1, "results depth");

		// enter → the episode streams; the show is NOT subscribed.
		m.mockInput.pressEnter();
		await waitFor(m, () => played.length === 1, "play called on enter");
		expect(played[0].id).toBe("stream-ep-1");
		expect(
			useFeedStore()
				.feeds()
				.some((f) => f.podcast.feedUrl === feedUrl),
		).toBe(false);
		expect(mockSearchStore.results()[0].podcast.isSubscribed).toBe(false);

		// a → subscribes in place (real feed fetch against the local server).
		m.mockInput.pressKey("a");
		await waitFor(
			m,
			() =>
				useFeedStore()
					.feeds()
					.some((f) => f.podcast.feedUrl === feedUrl),
			"a subscribes the show",
		);
		expect(mockSearchStore.results()[0].podcast.isSubscribed).toBe(true);

		// enter again → still streams (now under the subscribed show).
		m.mockInput.pressEnter();
		await waitFor(m, () => played.length === 2, "play called after subscribe");
		expect(played[1].id).toBe("stream-ep-1");
	} finally {
		m.renderer.destroy();
	}
});
