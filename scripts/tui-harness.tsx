#!/usr/bin/env bun
/**
 * PodTUI LLM-interactive harness — stateless per-turn snapshot bridge.
 *
 * Each invocation:
 *   1. Points XDG_CONFIG_HOME / XDG_DATA_HOME / PODTUI_AUDIO_BACKEND at a
 *      sandbox dir under .harness so your real ~/.config/podtui is never touched.
 *   2. Replays the saved action log (.harness/actions.json) from scratch.
 *   3. Appends + executes the new action passed on the CLI.
 *   4. Renders, captures structured spans, and prints: plain frame + distinct
 *      style summary (colors/attrs) + selected store state + captured issues
 *      (stderr / uncaught rejections). Full structured spans are dumped to
 *      .harness/last-frame.json every turn.
 *
 * Audio is silent (Noop) by default during the snapshot model so replaying the
 * log each turn doesn't re-trigger real playback. Pass --audio (or set
 * PODTUI_AUDIO_BACKEND) to flip to a real backend for the new action only.
 *
 * Import order mirrors src/index.tsx (lazy) to avoid a NavigationContext cycle.
 *
 * Usage:
 *   bun scripts/tui-harness.tsx init [--size 100x30] [--seed]
 *   bun scripts/tui-harness.tsx key <key> [mods...]      # mods: ctrl shift meta
 *   bun scripts/tui-harness.tsx arrow <up|down|left|right> [mods...]
 *   bun scripts/tui-harness.tsx enter|escape|tab|space|backspace
 *   bun scripts/tui-harness.tsx type "<text>"
 *   bun scripts/tui-harness.tsx wait <ms>
 *   bun scripts/tui-harness.tsx resize <w> <h>
 *   bun scripts/tui-harness.tsx frame                        # re-render, no new action
 *   bun scripts/tui-harness.tsx state [all|nav|audio|feed|app]
 *   bun scripts/tui-harness.tsx actions                      # print action log
 *   bun scripts/tui-harness.tsx reset
 *   bun scripts/tui-harness.tsx seed [--from ~/.config/podtui]
 *
 * Flags (after the subcommand):
 *   --size WxH      terminal size (default 100x30)
 *   --audio         enable real audio backend for the new action only
 *   --no-settle     skip the extra render-settle loops
 *   --styles        print the distinct-styles sample block (off by default)
 *   --verbose       restore the original multi-line pretty output
 */

import { testRender } from "@opentui/solid";
import {
	existsSync,
	mkdirSync,
	cpSync,
	writeFileSync,
	readFileSync,
} from "node:fs";
import { join } from "node:path";

// ── Paths & sandbox ────────────────────────────────────────────────────────
const HANDLES_DIR = ".harness";
const CONFIG_HOME = join(HANDLES_DIR, "config-home");
const DATA_HOME = join(HANDLES_DIR, "data-home");
const ACTIONS_FILE = join(HANDLES_DIR, "actions.json");
const FRAME_JSON = join(HANDLES_DIR, "last-frame.json");
const FRAME_TXT = join(HANDLES_DIR, "last-frame.txt");
const STATE_JSON = join(HANDLES_DIR, "state.json");

// Sandbox must be active BEFORE any app module is imported, so the app's
// config-dir / persistence reads resolve into .harness/*.
function activateSandbox(): void {
	mkdirSync(CONFIG_HOME, { recursive: true });
	mkdirSync(DATA_HOME, { recursive: true });
	process.env.XDG_CONFIG_HOME = join(process.cwd(), CONFIG_HOME);
	process.env.XDG_DATA_HOME = join(process.cwd(), DATA_HOME);
	// Silent audio during replay by default; --audio flips this after import.
	if (!process.env.PODTUI_AUDIO_BACKEND)
		process.env.PODTUI_AUDIO_BACKEND = "none";
}

// ── Action log ─────────────────────────────────────────────────────────────
type Mod = "ctrl" | "shift" | "meta" | "super" | "hyper";
type Action =
	| { t: "key"; k: string; mods?: Mod[] }
	| { t: "arrow"; d: "up" | "down" | "left" | "right"; mods?: Mod[] }
	| { t: "enter" | "escape" | "tab" | "space" | "backspace"; mods?: Mod[] }
	| { t: "type"; s: string }
	| { t: "wait"; ms: number }
	| { t: "resize"; w: number; h: number };

function loadActions(): Action[] {
	try {
		return JSON.parse(readFileSync(ACTIONS_FILE, "utf8") || "[]");
	} catch {
		return [];
	}
}
function saveActions(a: Action[]): void {
	writeFileSync(ACTIONS_FILE, JSON.stringify(a, null, 2));
}

// ── Issue capture ──────────────────────────────────────────────────────────
const issues: string[] = [];
// Captured by the StateProbe component rendered inside the provider tree —
// Solid contexts can only be read from within the tree, not from outside.
let navRef: any = null;
function captureIssues(): void {
	const origErr = console.error;
	const origWarn = console.warn;
	console.error = (...args: unknown[]) => {
		issues.push("stderr: " + args.map(String).join(" "));
		origErr(...(args as any[]));
	};
	console.warn = (...args: unknown[]) => {
		issues.push("warn: " + args.map(String).join(" "));
		origWarn(...(args as any[]));
	};
	process.on("uncaughtException", (e) =>
		issues.push("uncaught: " + ((e as Error)?.stack || String(e))),
	);
	process.on("unhandledRejection", (e) =>
		issues.push("unhandledRejection: " + ((e as Error)?.stack || String(e))),
	);
}

// ── Span rendering ─────────────────────────────────────────────────────────
type RGBA = { r: number; g: number; b: number; a: number };
type Span = {
	text: string;
	fg: RGBA | null;
	bg: RGBA | null;
	attributes: number;
	width: number;
};

const ATTR_NAMES: Record<string, number> = {
	BOLD: 1,
	DIM: 2,
	ITALIC: 4,
	UNDERLINE: 8,
	BLINK: 16,
	INVERSE: 32,
	HIDDEN: 64,
	STRIKETHROUGH: 128,
};

function hex(c: RGBA | null): string | null {
	if (!c) return null;
	if (c.a === 0) return null; // transparent → "default"
	const [r, g, b] = [c.r, c.g, c.b].map((v) =>
		Math.max(0, Math.min(255, Math.round(v))),
	);
	return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function attrLabels(attr: number): string[] {
	const out: string[] = [];
	for (const [name, bit] of Object.entries(ATTR_NAMES))
		if (attr & bit) out.push(name.toLowerCase());
	return out;
}

// (Plain frame text comes from captureCharFrame instead of span reconstruction.)

function distinctStyles(spans: {
	lines: { spans: Span[] }[];
}): { tag: string; sample: string; n: number }[] {
	const map = new Map<string, { tag: string; sample: string; n: number }>();
	for (const line of spans.lines) {
		for (const s of line.spans) {
			if (!s.text || s.text.trim() === "") continue;
			const fg = hex(s.fg as any);
			const bg = hex(s.bg as any);
			if (!fg && !bg && s.attributes === 0) continue; // default — skip
			const tags = attrLabels(s.attributes);
			const tag = `[fg=${fg ?? "·"} bg=${bg ?? "·"}${tags.length ? " " + tags.join("+") : ""}]`;
			const ex = map.get(tag);
			const sample = s.text.replace(/\n/g, "\\n").slice(0, 28);
			if (ex) {
				ex.n++;
				if (ex.sample.length < 14 && sample.length > ex.sample.length)
					ex.sample = sample;
			} else {
				map.set(tag, { tag, sample, n: 1 });
			}
		}
	}
	return [...map.values()].sort((a, b) => b.n - a.n).slice(0, 20);
}

// ── Arg parsing ────────────────────────────────────────────────────────────
function parseFlags(rest: string[]): {
	flags: Record<string, string | boolean>;
	positional: string[];
} {
	const flags: Record<string, string | boolean> = {};
	const positional: string[] = [];
	for (let i = 0; i < rest.length; i++) {
		const a = rest[i];
		if (a.startsWith("--")) {
			if (a === "--audio") flags.audio = true;
			else if (a === "--no-settle") flags["no-settle"] = true;
			else if (a === "--styles") flags.styles = true;
			else if (a === "--verbose") flags.verbose = true;
			else if (a === "--size") {
				flags.size = rest[++i];
				const m = /(\d+)x(\d+)/.exec(String(flags.size));
				if (m) {
					flags.w = m[1];
					flags.h = m[2];
				}
			} else if (a === "--from") {
				flags.from = rest[++i];
			} else {
				flags[a.slice(2)] = rest[++i] ?? true;
			}
		} else {
			positional.push(a);
		}
	}
	return { flags, positional };
}

function parseMods(positional: string[]): Mod[] {
	const mods: Mod[] = [];
	for (const p of positional)
		if (["ctrl", "shift", "meta", "super", "hyper"].includes(p))
			mods.push(p as Mod);
	return mods;
}

function buildAction(cmd: string, positional: string[]): Action | null {
	const mods = parseMods(positional);
	const first = positional[0];
	switch (cmd) {
		case "key":
			if (!first) throw new Error("key requires a <key> argument");
			return { t: "key", k: first, mods: mods.length ? mods : undefined };
		case "arrow":
			if (!first || !["up", "down", "left", "right"].includes(first))
				throw new Error("arrow requires up|down|left|right");
			return {
				t: "arrow",
				d: first as any,
				mods: mods.length ? mods : undefined,
			};
		case "enter":
		case "escape":
		case "tab":
		case "space":
		case "backspace":
			return { t: cmd, mods: mods.length ? mods : undefined };
		case "type":
			if (first === undefined) throw new Error("type requires <text>");
			// Re-join the rest in case text had spaces; positional[0] already is first token,
			// caller should quote. We join all positional as the text.
			return { t: "type", s: positional.join(" ") };
		case "wait":
			if (!first) throw new Error("wait requires <ms>");
			return { t: "wait", ms: parseInt(first, 10) || 0 };
		case "resize":
			if (!first || !positional[1]) throw new Error("resize requires <w> <h>");
			return {
				t: "resize",
				w: parseInt(first, 10) || 100,
				h: parseInt(positional[1], 10) || 30,
			};
		case "frame":
		case "state":
		case "reset":
		case "actions":
		case "init":
		case "seed":
			return null;
		default:
			throw new Error(`unknown command: ${cmd}`);
	}
}

// ── Execute one action against a mounted setup ──────────────────────────────
function fmtMods(mods?: Mod[]): Record<string, boolean> | undefined {
	if (!mods || !mods.length) return undefined;
	const o: Record<string, boolean> = {};
	for (const m of mods) o[m] = true;
	return o;
}

async function execAction(setup: any, a: Action): Promise<void> {
	const mi = setup.mockInput;
	switch (a.t) {
		case "key":
			mi.pressKey(a.k, fmtMods(a.mods));
			break;
		case "arrow":
			mi.pressArrow(a.d, fmtMods(a.mods));
			break;
		case "enter":
			mi.pressEnter(fmtMods(a.mods));
			break;
		case "escape":
			mi.pressEscape(fmtMods(a.mods));
			break;
		case "tab":
			mi.pressTab(fmtMods(a.mods));
			break;
		case "space":
			mi.pressKey("space");
			break;
		case "backspace":
			mi.pressBackspace(fmtMods(a.mods));
			break;
		case "type":
			await mi.typeText(a.s, 0);
			break;
		case "wait":
			await new Promise((r) => setTimeout(r, a.ms));
			break;
		case "resize":
			setup.resize(a.w, a.h);
			break;
	}
	await setup.renderOnce();
	// tiny settle for reactive updates
	await new Promise((r) => setTimeout(r, 40));
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
	activateSandbox();
	captureIssues();

	const argv = process.argv.slice(2);
	const cmd = argv[0] ?? "frame";
	const { flags, positional } = parseFlags(argv.slice(1));

	// Local-only commands that don't mount.
	if (cmd === "reset") {
		saveActions([]);
		console.log("✔ actions log cleared.");
		return;
	}
	if (cmd === "actions") {
		const a = loadActions();
		console.log(`Action log (${a.length}):`);
		console.log(JSON.stringify(a, null, 2));
		return;
	}
	if (cmd === "seed") {
		const from = String(
			flags.from || join(process.env.HOME || "~", ".config", "podtui"),
		);
		if (!existsSync(from)) {
			console.error(`seed source not found: ${from}`);
			process.exit(1);
		}
		const dest = join(process.env.XDG_CONFIG_HOME!, "podtui");
		cpSync(from, dest, { recursive: true });
		console.log(`✔ seeded sandbox config from ${from} → ${dest}`);
		return;
	}

	// Size settings.
	let width = 100;
	let height = 30;
	if (flags.w) width = parseInt(String(flags.w), 10);
	if (flags.h) height = parseInt(String(flags.h), 10);

	let newAction: Action | null = null;
	let actions: Action[] = [];
	if (cmd !== "init" && cmd !== "frame" && cmd !== "state") {
		newAction = buildAction(cmd, positional);
	}
	if (cmd === "init") {
		saveActions([]);
		actions = [];
	} else {
		actions = loadActions();
	}

	// Mount the real app. Lazy imports (order matters — see NavigationContext cycle).
	const { App } = await import("../src/App");
	const { ThemeProvider } = await import("../src/context/ThemeContext");
	const toast = await import("../src/ui/toast");
	const { KeybindProvider } = await import("../src/context/KeybindContext");
	const { NavigationProvider, useNavigation } = await import(
		"../src/context/NavigationContext"
	);
	const { DialogProvider } = await import("../src/ui/dialog");
	const { CommandProvider } = await import("../src/ui/command");

	// Probe rendered inside the provider tree so context hooks resolve.
	const StateProbe = () => {
		try {
			navRef = useNavigation();
		} catch (e) {
			issues.push("StateProbe: " + String(e));
		}
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
		width,
		height,
		useThread: false,
	});
	(setup.renderer as any).disableStdoutInterception?.();

	// Wait for providers (keybinds/theme/feeds) to settle.
	const settleLoops = flags["no-settle"] ? 2 : 12;
	for (let i = 0; i < settleLoops; i++) {
		await setup.renderOnce();
		await new Promise((r) => setTimeout(r, 60));
	}

	// Replay history silently (audio already Noop via env).
	for (const a of actions) await execAction(setup, a);

	// For the *new* action: if --audio, flip to a real backend just for it.
	let audioControls: any = null;
	try {
		const { useAudio } = await import("../src/hooks/useAudio");
		audioControls = useAudio();
	} catch (e) {
		issues.push("useAudio import: " + String(e));
	}
	if (newAction) {
		if (flags.audio && audioControls?.switchBackend) {
			// Re-detect: clear env so detection picks the best real backend.
			delete process.env.PODTUI_AUDIO_BACKEND;
			// Force (re)creation of a real backend; useAudio caches, switchBackend resets.
			await audioControls.switchBackend("mpv").catch(() => {});
			if (
				!audioControls.backendName() ||
				audioControls.backendName() === "none"
			) {
				await audioControls.switchBackend("afplay").catch(() => {});
			}
		}
		actions.push(newAction);
		saveActions(actions);
		await execAction(setup, newAction);
	}

	// Final settle + capture.
	await setup.renderOnce();
	await new Promise((r) => setTimeout(r, 60));
	const spans = setup.captureSpans() as {
		lines: { spans: Span[] }[];
		cols: number;
		rows: number;
		cursor: [number, number];
	};
	const plainFrame = setup.captureCharFrame();

	// Dump structured spans + plain frame.
	try {
		writeFileSync(FRAME_JSON, JSON.stringify(spans));
		writeFileSync(FRAME_TXT, plainFrame);
	} catch {}

	// Store state snapshot.
	const state: Record<string, unknown> = {};
	try {
		const nav = navRef;
		if (nav) {
			state.nav = {
				tab: nav.activeTab?.(),
				pane: nav.activePane?.(),
				mode: nav.mode?.(),
				input: nav.inputFocused?.(),
				sel: nav.selectedIds?.()?.length ?? 0,
				ready: nav.ready,
			};
		} else {
			state.nav = "NAV_REF not captured (probe did not run)";
		}
	} catch (e) {
		state.nav = "ERR: " + String(e);
	}
	try {
		if (audioControls) {
			state.audio = {
				backend: audioControls.backendName ? audioControls.backendName() : null,
				playing: audioControls.isPlaying ? audioControls.isPlaying() : null,
				pos: audioControls.position ? audioControls.position() : null,
				dur: audioControls.duration ? audioControls.duration() : null,
				vol: audioControls.volume ? audioControls.volume() : null,
				err: audioControls.error ? audioControls.error() : null,
				ep: audioControls.currentEpisode
					? audioControls.currentEpisode()?.title
					: null,
			};
		}
	} catch (e) {
		state.audio = "ERR: " + String(e);
	}
	try {
		const { useFeedStore } = await import("../src/stores/feed");
		const fs_ = useFeedStore();
		const feeds = fs_.feeds ? fs_.feeds() : [];
		state.feed = {
			count: feeds?.length ?? 0,
			sel: fs_.selectedFeedId ? fs_.selectedFeedId() : null,
			loading: fs_.isLoadingFeeds ? fs_.isLoadingFeeds() : null,
			titles: (feeds ?? []).slice(0, 8).map((f: any) => f?.podcast?.title),
		};
	} catch (e) {
		state.feed = "ERR: " + String(e);
	}
	try {
		writeFileSync(STATE_JSON, JSON.stringify(state));
	} catch {}

	// ── Output ──────────────────────────────────────────────────────────────
	// Compact by default: trimmed frame, one-line state per section, no styles
	// block, no boilerplate footer. Use --styles / --verbose to opt back in.
	const verbose = !!flags.verbose;
	const scope = cmd === "state" ? String(positional[0] || "all") : "all";

	// A line is "visually empty" if it's either fully blank OR contains only
	// box-drawing chars + whitespace (i.e. empty-pane interior padding like
	// "│   │"). Runs of these collapse to a single `…N` marker so an empty
	// 24-row pane costs 1 line, not 18.
	const BOX_CHARS = "│┌┐└─┤├┬┴┼┐┘┌└┤├┬┴┼┌┐└┘─│┤├┬┴┼";
	const isVisuallyEmpty = (l: string): boolean =>
		l === "" || [...l].every((ch) => ch === " " || BOX_CHARS.includes(ch));
	const frameTrimmed = (() => {
		const lines = plainFrame
			.replace(/\n+$/, "")
			.split("\n")
			.map((l) => l.replace(/\s+$/, ""));
		while (lines.length && isVisuallyEmpty(lines[lines.length - 1]))
			lines.pop();
		const out: string[] = [];
		let blank = 0;
		const flushBlanks = () => {
			if (blank >= 3) out.push(`  …${blank} empty`);
			else for (let i = 0; i < blank; i++) out.push("");
			blank = 0;
		};
		for (const l of lines) {
			if (isVisuallyEmpty(l)) {
				blank++;
			} else {
				flushBlanks();
				out.push(l);
			}
		}
		flushBlanks();
		return out.join("\n");
	})();

	console.log(
		`FRAME ${spans.cols}x${spans.rows} cur=${spans.cursor[0]},${spans.cursor[1]} acts=${actions.length} ${cmd}`,
	);
	console.log(frameTrimmed);

	// ── distinct styles: opt-in only (--styles OR --verbose) ──
	if (scope === "all" && (flags.styles || verbose)) {
		const styles = distinctStyles(spans);
		if (styles.length) {
			console.log("-- styles (top 20) --");
			for (const s of styles) console.log(`  ${s.tag} ×${s.n} “${s.sample}”`);
		}
	}

	// ── state: one compact line per requested section ──
	const want = (k: string) => scope === "all" || scope === k;
	const compact = (obj: unknown): string =>
		verbose ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
	if (want("nav")) console.log("nav " + compact(state.nav));
	if (want("audio")) console.log("audio " + compact(state.audio));
	if (want("feed")) console.log("feed " + compact(state.feed));
	if (want("app")) console.log("app (not dumped in v1)");

	// ── issues: terse ──
	if (issues.length) {
		console.log(`issues:${issues.length}`);
		for (const i of issues.slice(0, 20)) console.log("  ! " + i);
	} else {
		console.log("issues:none");
	}

	// Footer is identical every run — only print on init or --verbose.
	if (cmd === "init" || verbose) {
		console.log(
			`(spans ${FRAME_JSON} | frame ${FRAME_TXT} | state ${STATE_JSON})`,
		);
	}

	// Tear down child processes (audio backend) before exit to avoid orphans.
	try {
		if (audioControls?.stop) await audioControls.stop().catch(() => {});
	} catch (e) {
		issues.push("teardown audio: " + String(e));
	}
	try {
		setup.renderer.destroy();
	} catch (e) {
		issues.push("teardown renderer: " + String(e));
	}
	process.exit(0);
}

main().catch((err) => {
	console.error("HARNESS FAILED:", err?.stack || err);
	process.exit(1);
});
