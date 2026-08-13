/**
 * discover-episode-preview.test.tsx — Discover: `l`/right/enter on a podcast
 * result must OPEN the show's episode list, NOT subscribe.
 *
 * Regression: `open` on a Discover podcast result (bound to `l`/right via
 * `swipe-next`, and to enter) used to toggle subscription — pressing `l` on a
 * show you wanted to browse subscribed it instead. `l`/right/enter now drill
 * into a fetched-on-demand episode list (depth 2, no subscription), and `a`
 * (the app-wide `subscribe` action) is the dedicated subscribe key.
 *
 * Mounts the real app (sandboxed, silent audio, mocked discover store) and
 * drives the Discover tab with the test renderer's mock keys: drill category
 * → podcast, `l` opens the episode list WITHOUT subscribing (feed store
 * untouched, subscribe not called); `h` pops back; `a` subscribes the
 * focused show; `l` then re-opens the episodes.
 *
 * App modules are loaded dynamically (never statically) because the sandbox
 * config/data dirs must be set BEFORE they evaluate — their module-level init
 * reads those env vars at import time.
 */

import { test, expect, afterAll, beforeAll, mock } from "bun:test";
import { testRender } from "@opentui/solid";
import { createSignal } from "solid-js";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { AudioControls } from "../src/hooks/useAudio";
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

// Deterministic discover store: `openEpisodes` seeds the episode list
// synchronously (no network), `subscribe`/`unsubscribe` flip the show's flag
// and are recorded so the test can assert l/enter never subscribed.
const [selectedCategory, setSelectedCategory] = createSignal<string>("all");
const [isLoading, setIsLoading] = createSignal(false);
const [podcasts, setPodcasts] = createSignal<Podcast[]>([]);
const [preview, setPreview] = createSignal<Record<string, Episode[]>>({});
const [previewLoading, setPreviewLoading] = createSignal<Set<string>>(
	new Set(),
);
const [previewErrors, setPreviewErrors] = createSignal<Record<string, string>>(
	{},
);
const subscribeCalls: string[] = [];
const openCalls: string[] = [];
const flip = (id: string, subscribed: boolean) =>
	setPodcasts((prev) =>
		prev.map((p) => (p.id === id ? { ...p, isSubscribed: subscribed } : p)),
	);
const mockDiscoverStore = {
	selectedCategory,
	isLoading,
	podcasts,
	categories: [
		{ id: "all", name: "All", icon: "" },
		{ id: "technology", name: "Technology", icon: "" },
	],
	filteredPodcasts: () => {
		const cat = selectedCategory();
		if (cat === "all") return podcasts();
		return podcasts().filter((p) =>
			(p.categories ?? []).some((c) =>
				c.toLowerCase().includes(cat.toLowerCase()),
			),
		);
	},
	setSelectedCategory,
	subscribe: (id: string) => {
		subscribeCalls.push(id);
		flip(id, true);
	},
	unsubscribe: (id: string) => {
		flip(id, false);
	},
	refresh: async () => {},
	episodesForPodcast: (id: string) => preview()[id] ?? [],
	isLoadingEpisodesFor: (id: string) => previewLoading().has(id),
	previewError: (id: string) => previewErrors()[id],
	openEpisodes: async (pod: Podcast) => {
		openCalls.push(pod.id);
		setPreview((prev) => ({
			...prev,
			[pod.id]: [makeEpisode(1), makeEpisode(2)],
		}));
	},
	refreshEpisodes: async () => {},
};
mock.module("../src/stores/discover", () => ({
	DISCOVER_CATEGORIES: mockDiscoverStore.categories,
	useDiscoverStore: () => mockDiscoverStore,
}));

// Sandbox BEFORE any app module evaluates — config-dir/persistence read these
// env vars at import time, so the app modules are loaded dynamically.
const SANDBOX = join(process.cwd(), ".harness", "test-discover-preview");
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

function makePodcast(): Podcast {
	return {
		id: "featured-show",
		title: "Featured Show",
		description: "A featured show.",
		feedUrl: "https://example.test/featured.xml",
		author: "tester",
		categories: ["Technology"],
		lastUpdated: new Date(),
		isSubscribed: false,
	};
}

function makeEpisode(n: number): Episode {
	return {
		id: `featured-ep-${n}`,
		podcastId: "featured-show",
		title: `Featured Episode ${n}`,
		description: "",
		audioUrl: "https://example.test/ep.mp3",
		duration: 0,
		pubDate: new Date(`2026-08-0${n}T00:00:00Z`),
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
	setPodcasts([makePodcast()]);
});

afterAll(() => {
	rmSync(SANDBOX, { recursive: true, force: true });
});

test("l on a podcast opens its episode list without subscribing; a subscribes", async () => {
	const m = await mountApp();
	try {
		await settleReady(m);

		// Open the Discover tab (digit press retried until the router attaches).
		for (let i = 0; i < 20 && m.nav().activeTab() !== TABS.DISCOVER; i++) {
			m.mockInput.pressKey("3");
			await m.renderOnce();
			await sleep(40);
		}
		expect(m.nav().activeTab()).toBe(TABS.DISCOVER);
		m.mockInput.pressEnter(); // open the tab's content (category depth)
		await waitFor(
			m,
			() => m.nav().currentDepth() === 0 && !m.nav().atRootTab(),
			"discover content mounted",
		);

		// l on the focused category drills to the podcast results (depth 1).
		m.mockInput.pressKey("l");
		await waitFor(m, () => m.nav().currentDepth() === 1, "results depth");
		expect(m.nav().topFrame()?.kind).toBe("results");

		// l on the focused podcast opens its episode list (depth 2) — the
		// show must NOT be subscribed, the feed store untouched.
		m.mockInput.pressKey("l");
		await waitFor(m, () => m.nav().currentDepth() === 2, "episodes depth");
		expect(m.nav().topFrame()?.kind).toBe("episodes");
		expect(m.nav().topFrame()?.ctx).toBe("featured-show");
		expect(openCalls).toEqual(["featured-show"]);
		expect(subscribeCalls).toHaveLength(0);
		expect(played).toHaveLength(0);
		expect(
			useFeedStore()
				.feeds()
				.some((f) => f.podcast.id === "featured-show"),
		).toBe(false);
		// The seeded episode list is what the page renders at depth 2.
		expect(mockDiscoverStore.episodesForPodcast("featured-show")).toHaveLength(
			2,
		);

		// h pops back to the results (depth 1).
		m.mockInput.pressKey("h");
		await waitFor(m, () => m.nav().currentDepth() === 1, "back to results");

		// a subscribes the focused show (the dedicated subscribe key).
		m.mockInput.pressKey("a");
		await waitFor(
			m,
			() => mockDiscoverStore.podcasts()[0]?.isSubscribed === true,
			"a subscribes the show",
		);
		expect(subscribeCalls).toEqual(["featured-show"]);

		// l still opens the episode list for a subscribed show (no toggle).
		m.mockInput.pressKey("l");
		await waitFor(m, () => m.nav().currentDepth() === 2, "episodes re-opened");
		expect(subscribeCalls).toEqual(["featured-show"]);
		expect(mockDiscoverStore.episodesForPodcast("featured-show")).toHaveLength(
			2,
		);
	} finally {
		m.renderer.destroy();
	}
});
