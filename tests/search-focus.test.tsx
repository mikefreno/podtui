/**
 * search-focus.test.tsx — the search query input's focus flag must follow its
 * REAL focus, not a flag that outlives it.
 *
 * Regression: clicking off the query input (opentui's mouse dispatch
 * auto-focuses the clicked target's nearest focusable ancestor, blurring the
 * input) used to leave `nav.inputFocused()` stuck true while the renderable
 * was unfocused. The Shell keyboard router then yielded every key to a
 * non-existent input: Esc wouldn't defocus, `s` wouldn't refocus, j/k/h did
 * nothing. The input now drives the flag through useInputFocusNav
 * (FOCUSED/BLURRED), so click-off drops the flag and keyboard control resumes;
 * clicking the input focuses it.
 *
 * Mounts the real app (sandboxed, silent audio) via the same provider tree as
 * scripts/tui-harness.tsx and drives it with the test renderer's mock keys +
 * mouse. Layout is deterministic at 100x30: tab list 20 cols, current pane
 * x=20..69 (content padded 1), so the query input row is y=1, x=29..57 and the
 * pane interior is blank at (60,5).
 *
 * KNOWN FLAKE (full-suite CPU contention): both tests occasionally fail inside
 * openSearch — the tab-digit press or the post-Enter input focus doesn't land
 * within the retry budget (20 × press+render+40ms, then a 5s waitFor). Passes
 * reliably in isolation (`bun test tests/search-focus.test.tsx`, ~2s).
 * Observed 2026-08-11 on an M3 Pro: two consecutive red full-suite runs
 * (`timed out waiting for: input focused on tab entry` / `Expected: 4,
 * Received: 1`), then two consecutive green — timing under load, not state.
 * If a full-suite run reports these two, re-run the file alone to confirm
 * before treating it as a regression.
 */

import { test, expect, afterAll, mock } from "bun:test";
import { testRender } from "@opentui/solid";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { AudioControls } from "../src/hooks/useAudio";

// Other test files that `mock.module("../src/hooks/useAudio")` can share this
// file's worker (bun reuses workers; the mock leaks into the module registry
// here). That stub only has duration/position/seek, so the Shell's render
// throws on audio.currentEpisode() and no key router ever attaches — presses
// go nowhere. Register a complete no-op stub FIRST so the app mounts
// regardless of what leaked in before us.
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
	play: async () => {},
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

// Sandbox BEFORE any app module evaluates — config-dir/persistence read these
// env vars at import time. Static imports are hoisted above this code, so the
// app modules must be loaded dynamically (mirrors scripts/tui-harness.tsx).
const SANDBOX = join(process.cwd(), ".harness", "test-focus");
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

// Click coordinates (0-based) in the 100x30 layout — see file header.
const INPUT_CLICK = { x: 35, y: 1 };
const PILL_EPISODES = { x: 44, y: 3 };
const BLANK_PANE = { x: 60, y: 5 };

type Mounted = {
	renderer: any;
	renderOnce: () => Promise<void>;
	mockInput: any;
	mockMouse: any;
	nav: () => {
		inputFocused: () => boolean;
		currentDepth: () => number;
		activeTab: () => number;
	};
	keybindsReady: () => boolean;
};

/** Mount the real app and return drivers + nav/keybind probes (contexts are
 *  only readable inside the provider tree). */
async function mountApp(): Promise<Mounted> {
	let navRef: any = null;
	let keybindsRef: any = null;
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
	(setup.renderer as unknown as { disableStdoutInterception?: () => void }).disableStdoutInterception?.();
	// Initial mount settle; keybind readiness is awaited separately in
	// settleReady before any keypress.
	await setup.renderOnce();
	await new Promise((r) => setTimeout(r, 60));
	return {
		renderer: setup.renderer,
		renderOnce: setup.renderOnce,
		mockInput: setup.mockInput,
		mockMouse: setup.mockMouse,
		nav: () => navRef,
		keybindsReady: () => keybindsRef?.ready ?? false,
	};
}

/** Render + settle until the keybind router is ready (it loads keybinds from
 *  disk asynchronously on mount); the first keypress would otherwise be lost
 *  under full-suite CPU contention. */
async function settleReady(m: Mounted): Promise<void> {
	for (let i = 0; i < 80; i++) {
		await m.renderOnce();
		await new Promise((r) => setTimeout(r, 60));
		if (m.keybindsReady()) return;
	}
	throw new Error("keybinds never became ready");
}

/** Navigate to the Search tab's query depth (input auto-focuses on entry).
 *  The tab-digit press is retried until it lands: the first press can fire
 *  before the Shell's key router attaches (keybinds load asynchronously), so
 *  re-pressing self-heals instead of flaking under suite contention. */
async function openSearch(m: Mounted): Promise<void> {
	await settleReady(m);
	for (let i = 0; i < 20 && m.nav().activeTab() !== TABS.SEARCH; i++) {
		m.mockInput.pressKey("4");
		await m.renderOnce();
		await new Promise((r) => setTimeout(r, 40));
	}
	expect(m.nav().activeTab()).toBe(TABS.SEARCH);
	m.mockInput.pressEnter();
	await waitFor(m, () => m.nav().inputFocused(), "input focused on tab entry");
}

/** Render + sleep until `cond` holds or the timeout elapses. Fixed sleeps after
 *  input/mouse actions flake under full-suite CPU contention, so state
 *  transitions are polled instead. */
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
		await new Promise((r) => setTimeout(r, 25));
	}
	throw new Error(`timed out waiting for: ${what}`);
}

/** The renderable the renderer currently considers focused (if any). */
function focusedName(m: Mounted): string | null {
	const r = m.renderer.currentFocusedRenderable;
	return r ? `${r.constructor?.name} id=${r.id}` : null;
}

afterAll(() => {
	rmSync(SANDBOX, { recursive: true, force: true });
});

test("clicking off the query input drops inputFocused; s and Esc restore keyboard control", async () => {
	const m = await mountApp();
	try {
		await openSearch(m);
		expect(m.nav().inputFocused()).toBe(true);

		// Click off the input (scope pill). Real focus moves to the pane's
		// scrollbox, blurring the input — the flag must follow.
		await m.mockMouse.click(PILL_EPISODES.x, PILL_EPISODES.y);
		await waitFor(m, () => !m.nav().inputFocused(), "flag off after pill click");
		expect(focusedName(m)).not.toMatch(/^Input/);

		// `s` (search action) must refocus the input for typing.
		m.mockInput.pressKey("s");
		await waitFor(m, () => m.nav().inputFocused(), "s refocuses the input");
		expect(focusedName(m)).toMatch(/^Input/);

		// Escape defocuses; the flag stays off (no depth change re-seeds it).
		m.mockInput.pressEscape();
		await waitFor(m, () => !m.nav().inputFocused(), "escape defocuses");

		// Click-off a second time (blank pane interior). The flag is already
		// false from the escape, so a state-poll can't observe the click; check
		// directly that the click did NOT re-focus the input, then that j is
		// not swallowed (flag stays false, nothing re-grabs focus).
		await m.mockMouse.click(BLANK_PANE.x, BLANK_PANE.y);
		await m.renderOnce();
		await new Promise((r) => setTimeout(r, 40));
		expect(m.nav().inputFocused()).toBe(false);
		m.mockInput.pressKey("j");
		await m.renderOnce();
		await new Promise((r) => setTimeout(r, 40));
		expect(m.nav().inputFocused()).toBe(false);
	} finally {
		m.renderer.destroy();
	}
});

test("clicking the query input focuses it (typing mode)", async () => {
	const m = await mountApp();
	try {
		await openSearch(m);
		// Defocus first so the click has something to restore.
		m.mockInput.pressEscape();
		await waitFor(m, () => !m.nav().inputFocused(), "escape defocuses");

		await m.mockMouse.click(INPUT_CLICK.x, INPUT_CLICK.y);
		await waitFor(m, () => m.nav().inputFocused(), "input click focuses");
		expect(focusedName(m)).toMatch(/^Input/);
	} finally {
		m.renderer.destroy();
	}
});

