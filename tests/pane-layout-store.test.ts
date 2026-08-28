/**
 * pane-layout-store.test.ts — the shared pane-split store: splitPixels
 * clamping, border moves that respect per-pane minimum widths, and
 * commit() persistence into the app preferences.
 */
import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the config dir at a throwaway directory BEFORE importing the store
// (its module-level init reads it).
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "podtui-panecfg-"));

// The config dir must be set before the module is evaluated, so the app
// store is loaded dynamically here rather than statically at the top.
const { splitPixels, createPaneLayoutStore, DEFAULT_PANE_SPLITS } = await import(
	"../src/stores/pane-layout"
);
const { useAppStore } = await import("../src/stores/app");

beforeAll(async () => {
	await useAppStore().whenReady();
});
afterAll(() => {
	// Restore pristine preferences so a later file sharing this process
	// (bun test reuses the module registry) renders the default split.
	useAppStore().updatePreferences({ paneSplit: DEFAULT_PANE_SPLITS });
});

test("default splits mirror the historical 2:5:3 ratio at width 100", () => {
	expect(DEFAULT_PANE_SPLITS).toEqual({ left: 0.2, right: 0.7 });
	const { leftPx, rightPx } = splitPixels(100, DEFAULT_PANE_SPLITS);
	expect(leftPx).toBe(20);
	expect(rightPx).toBe(70);
});

test("splitPixels maps splits 1:1 to pixels (ratio exact at every width)", () => {
	// Pure fraction→pixel mapping — no minimum enforcement in rendering.
	expect(splitPixels(100, { left: 0.6, right: 0.7 })).toEqual({
		leftPx: 60,
		rightPx: 70,
	});
	expect(splitPixels(70, { left: 0.2, right: 0.7 })).toEqual({
		leftPx: 14,
		rightPx: 49,
	});
});

test("splitPixels handles zero-width and degenerate terminals", () => {
	expect(splitPixels(0, DEFAULT_PANE_SPLITS)).toEqual({ leftPx: 0, rightPx: 0 });
	const tiny = splitPixels(40, { left: 0.2, right: 0.7 });
	expect(tiny.leftPx).toBe(8);
	expect(tiny.rightPx).toBe(28);
});

test("setRight clamps the preview to its minimum", () => {
	const store = createPaneLayoutStore();
	store.setRight(97, 100); // preview can't shrink below 15
	expect(store.splits().right).toBeCloseTo(0.85, 5);
	// The parent minimum also holds when the left border is dragged.
	store.setLeft(1, 100);
	expect(store.splits().left).toBeCloseTo(0.15, 5);
});

test("setLeft moves the border and normalizes stored fractions", () => {
	const store = createPaneLayoutStore();
	store.setLeft(40, 100);
	expect(store.splits().left).toBeCloseTo(0.4, 5);
	expect(store.splits().right).toBeCloseTo(0.7, 5);
});

test("setLeft below the parent minimum clamps up", () => {
	const store = createPaneLayoutStore();
	store.setLeft(5, 100);
	expect(store.splits().left).toBeCloseTo(0.15, 5);
});

test("setLeft beyond the current minimum forces the right border right", () => {
	const store = createPaneLayoutStore();
	store.setLeft(60, 100);
	expect(store.splits().left).toBeCloseTo(0.55, 5);
	expect(store.splits().right).toBeCloseTo(0.85, 5);
});

test("setRight respects the current and preview minimums", () => {
	const store = createPaneLayoutStore();
	store.setRight(80, 100);
	expect(store.splits().right).toBeCloseTo(0.8, 5);
	store.setRight(40, 100); // must not cross below leftPx(20) + minCurrent(30)
	expect(store.splits().right).toBeCloseTo(0.5, 5);
});

test("commit persists the split into the app preferences", async () => {
	const store = createPaneLayoutStore();
	store.setLeft(35, 100);
	store.commit();
	await useAppStore().whenReady();
	expect(useAppStore().state().preferences.paneSplit.left).toBeCloseTo(0.35, 5);
	expect(useAppStore().state().preferences.paneSplit.right).toBeCloseTo(0.7, 5);
});
