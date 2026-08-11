/**
 * volume-persistence.test.ts — "store and reuse the previous session's
 * audio level" feature.
 *
 * useAudio's volume starts at 100% (default, before any user change);
 * setVolume() persists the new level to app settings (config.json); and
 * at boot the volume signal re-syncs from the persisted settings — so the
 * next session resumes at the previous level.
 *
 * Same worker-leak defenses as restore-session.test.ts: other test files
 * mock.module("../src/hooks/useAudio") and bun reuses workers, so the real
 * module is imported via a query-suffixed specifier (distinct module
 * identity, loads from disk). A fresh module instance simulates the next
 * launch: its refCount starts at 0, so its boot sync re-reads settings.
 * The boot sync awaits the app store's async config load (whenReady), so
 * tests await it too and flush microtasks — no wall-clock sleeps.
 */
import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── Sandbox BEFORE any app module evaluates ───────────────────────────────
const CONFIG = mkdtempSync(join(tmpdir(), "podtui-volume-"));
process.env.XDG_CONFIG_HOME = CONFIG;
process.env.XDG_DATA_HOME = mkdtempSync(join(tmpdir(), "podtui-volume-data-"));
process.env.PODTUI_AUDIO_BACKEND = "none";

// ── Real modules ──────────────────────────────────────────────────────────
// @ts-expect-error — bun-only query suffix: distinct module identity that
// loads the real file instead of a leaked mock.module from another test file.
const { useAudio } = await import("../src/hooks/useAudio?restore-test");
const { useAppStore } = await import("../src/stores/app");

/** Flush the boot sync's promise chain (whenReady.then(...)) — microtasks
 *  only, no timers. */
async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

test("volume defaults to 100% and is persisted and reused across sessions", async () => {
	const appStore = useAppStore();
	await appStore.whenReady(); // empty sandbox config → defaults

	// Boot 1: no persisted volume — the default is 100% (not the old 70%).
	const audio = useAudio();
	await flushMicrotasks();
	expect(audio.volume()).toBe(1);
	expect(appStore.state().settings.volume).toBe(1);

	// User change: signal updates and the level lands in app settings.
	await audio.setVolume(0.35);
	expect(audio.volume()).toBe(0.35);
	expect(appStore.state().settings.volume).toBe(0.35);

	// Boot 2 (fresh module instance — refCount starts at 0, so the boot
	// sync re-reads settings): the previous session's level is restored.
	// @ts-expect-error — same bun-only query-suffix mechanism as above.
	const { useAudio: useAudioNext } = await import("../src/hooks/useAudio?restore-test-vol");
	const nextAudio = useAudioNext();
	await flushMicrotasks();
	expect(nextAudio.volume()).toBe(0.35);
});

test("setVolume clamps to the 0–1 range before persisting", async () => {
	const audio = useAudio();
	await audio.setVolume(1.7);
	expect(audio.volume()).toBe(1);
	expect(useAppStore().state().settings.volume).toBe(1);

	await audio.setVolume(-0.3);
	expect(audio.volume()).toBe(0);
	expect(useAppStore().state().settings.volume).toBe(0);
});

test("a persisted volume wins over the default at boot", async () => {
	// Persist a non-default level, then simulate a fresh launch that has no
	// prior signal state (new module instance).
	useAppStore().updateSettings({ volume: 0.6 });
	// @ts-expect-error — same bun-only query-suffix mechanism as above.
	const { useAudio: useAudioNext } = await import("../src/hooks/useAudio?restore-test-vol2");
	const nextAudio = useAudioNext();
	await flushMicrotasks();
	expect(nextAudio.volume()).toBe(0.6);
});
