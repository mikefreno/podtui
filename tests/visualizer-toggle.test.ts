/**
 * visualizer-toggle.test.ts — "waveform visualizer toggleable on/off in
 * settings, default on".
 *
 * Pins three contracts:
 *  1. The default is ON (fresh config, before any user change).
 *  2. The Settings → Visualizer "Waveform" item flips it via updateVisualizer.
 *  3. Persistence: a config saved BEFORE `enabled` existed (no key) still
 *     loads as ON with its other visualizer fields intact (deep-merge
 *     backfill), and an explicit `enabled: false` survives a reload.
 *
 * The config dir is derived from XDG_CONFIG_HOME at call time, so each
 * persistence test points it at a fresh tmpdir and writes its own
 * config.json before calling loadAppStateFromFile directly.
 */
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── Sandbox BEFORE any app module evaluates ───────────────────────────────
const CONFIG = mkdtempSync(join(tmpdir(), "podtui-viz-toggle-"));
process.env.XDG_CONFIG_HOME = CONFIG;
process.env.XDG_DATA_HOME = mkdtempSync(join(tmpdir(), "podtui-viz-toggle-data-"));
process.env.PODTUI_AUDIO_BACKEND = "none";

const { useAppStore } = await import("../src/stores/app");
const { useVisualizerItems } = await import(
	"../src/pages/Settings/VisualizerSettings"
);
const { loadAppStateFromFile } = await import("../src/utils/app-persistence");

/** Write a config.json into a fresh XDG_CONFIG_HOME and load app state. */
async function loadWithConfig(settings: unknown): Promise<{
	state: ReturnType<typeof loadAppStateFromFile> extends Promise<infer T>
		? T
		: never;
}> {
	const dir = mkdtempSync(join(tmpdir(), "podtui-viz-toggle-cfg-"));
	process.env.XDG_CONFIG_HOME = dir;
	mkdirSync(join(dir, "podtui"), { recursive: true });
	writeFileSync(
		join(dir, "podtui", "config.json"),
		JSON.stringify({ settings }, null, 2),
	);
	return { state: await loadAppStateFromFile() };
}

test("waveform visualizer defaults to ON with a fresh config", async () => {
	const app = useAppStore();
	await app.whenReady(); // empty sandbox config → defaults
	expect(app.state().settings.visualizer.enabled).toBe(true);
});

test("Settings → Visualizer exposes a Waveform toggle that flips the setting", async () => {
	const app = useAppStore();
	await app.whenReady();
	const items = useVisualizerItems();
	const item = items.find((it) => it.id === "enabled");
	expect(item).toBeDefined();
	expect(item!.kind).toBe("toggle");
	expect(item!.display()).toBe("On");

	item!.toggle!();
	expect(app.state().settings.visualizer.enabled).toBe(false);
	expect(item!.display()).toBe("Off");

	item!.toggle!();
	expect(app.state().settings.visualizer.enabled).toBe(true);
	expect(item!.display()).toBe("On");
});

test("a config saved before `enabled` existed loads as ON with other fields intact", async () => {
	const { state } = await loadWithConfig({
		visualizer: { bars: 16, lowCutOff: 80 },
	});
	expect(state.settings.visualizer.enabled).toBe(true); // backfilled
	expect(state.settings.visualizer.bars).toBe(16); // preserved, not clobbered
	expect(state.settings.visualizer.lowCutOff).toBe(80);
});

test("an explicit enabled:false survives a reload", async () => {
	const { state } = await loadWithConfig({
		visualizer: { enabled: false, bars: 128 },
	});
	expect(state.settings.visualizer.enabled).toBe(false);
	expect(state.settings.visualizer.bars).toBe(128);
});

test("an empty visualizer object in config falls back to full defaults", async () => {
	const { state } = await loadWithConfig({ visualizer: {} });
	expect(state.settings.visualizer.enabled).toBe(true);
	expect(state.settings.visualizer.bars).toBeGreaterThan(0);
});
