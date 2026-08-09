/**
 * auto-jump.test.ts — "auto jump to player on podcast start" feature.
 *
 * The Shell subscribes to the `player.started` event (emitted by useAudio when
 * a NEW episode begins, not on resume) and, when `autoJumpToPlayer` is enabled,
 * performs `nav.setActiveTab(TABS.PLAYER)` + `nav.enterTabContent()` to land in
 * the Player content pane. These tests pin that jump contract against the real
 * nav store (the exact two calls the Shell handler makes) and pin the default
 * value of the new preference.
 */
import { test, expect } from "bun:test";
import { createRoot } from "solid-js";
import {
	createNavigation,
	type NavigationState,
} from "../src/context/navigation-store";
import { TABS } from "../src/utils/navigation";
import { loadAppStateFromFile } from "../src/utils/app-persistence";

function withNav(fn: (nav: NavigationState) => void) {
	createRoot((dispose) => {
		const nav = createNavigation();
		fn(nav);
		dispose();
	});
}

test("auto-jump: PLAYER + enterTabContent lands in the Player content pane", () => {
	withNav((nav) => {
		// Exact call sequence the Shell handler runs on `player.started`.
		nav.setActiveTab(TABS.PLAYER);
		nav.enterTabContent();
		expect(nav.activeTab()).toBe(TABS.PLAYER);
		// Content entered: tab list is no longer the CURRENT pane.
		expect(nav.atRootTab()).toBe(false);
	});
});

test("auto-jump: preference defaults to true on a config without the field", async () => {
	// Existing configs predate the field; load must merge in the default true.
	const state = await loadAppStateFromFile();
	expect(state.preferences.autoJumpToPlayer).toBe(true);
});
