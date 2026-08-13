/**
 * PreferencesPanel — exposes theme/font/speed/explicit/auto-download as
 * SettingItems for the yazi depth-stack. No own useKeyboard; all movement is
 * driven by the Shell router via nav.action.
 *
 * Auto-download (global setting, see stores/feed.ts runAutoDownload):
 *   • Auto Download Whitelist — shown only when scope is "whitelist": search
 *                            field over subscribed shows; suggestions toggle
 *                            in/out with Space (j/k to move, Esc to browse).
 *   • Episode Cache Mode   — date or count bound for the episode list
 *                            (default: date)
 *   • Episode Cache Count  — N most recent episodes when mode is count
 *                            (default: 25)
 *   • Episode Cache Days   — rolling N-day window when mode is date
 *                            (default: 60)
 */

import { createSignal, Show, For, onMount, onCleanup } from "solid-js";
import { RenderableEvents, type InputRenderable } from "@opentui/core";
import { useAppStore } from "@/stores/app";
import { useFeedStore } from "@/stores/feed";
import { useTheme } from "@/context/ThemeContext";
import { useInputFocusNav } from "@/hooks/useInputFocusNav";
import { useScrollIntoView } from "@/hooks/useScrollIntoView";
import { useSelectionMarker } from "@/hooks/useSelectionMarker";
import {
	NavMode,
	useNavigation,
	DEPTH_CENTER_PANE,
	type PaneId,
} from "@/context/NavigationContext";
import { on } from "@/utils/event-bus";
import type { KeybindActionName } from "@/context/KeybindContext";
import { TABS } from "@/utils/navigation";
import type { AutoDownloadScope, EpisodeCacheMode, ThemeName } from "@/types/settings";
import type { Feed } from "@/types/feed";
import type { SettingItem } from "./types";

const THEME_LABELS: Array<{ value: ThemeName; label: string }> = [
	{ value: "system", label: "System" },
	{ value: "catppuccin", label: "Catppuccin" },
	{ value: "gruvbox", label: "Gruvbox" },
	{ value: "tokyo", label: "Tokyo" },
	{ value: "nord", label: "Nord" },
	{ value: "custom", label: "Custom" },
];

const SCOPE_LABELS: Array<{ value: AutoDownloadScope; label: string }> = [
	{ value: "all", label: "All" },
	{ value: "none", label: "None" },
	{ value: "whitelist", label: "Whitelist" },
];
const CACHE_MODE_LABELS: Array<{ value: EpisodeCacheMode; label: string }> = [
	{ value: "date", label: "Date" },
	{ value: "count", label: "Count" },
];

function cacheModeLabel(mode: EpisodeCacheMode): string {
	return CACHE_MODE_LABELS.find((s) => s.value === mode)?.label ?? mode;
}

function scopeLabel(scope: AutoDownloadScope): string {
	return SCOPE_LABELS.find((s) => s.value === scope)?.label ?? scope;
}

export function usePreferencesItems(): SettingItem[] {
	const app = useAppStore();
	const feedStore = useFeedStore();

	const settings = () => app.state().settings;
	const prefs = () => app.state().preferences;

	const items: SettingItem[] = [
		{
			id: "theme",
			label: "Theme",
			kind: "select",
			display: () =>
				THEME_LABELS.find((t) => t.value === settings().theme)?.label ??
				settings().theme,
			help: () =>
				`Color theme.\nType: select\nDefault: system\nCurrent: ${settings().theme}\nCycle with j/k; Enter to apply.`,
			cycle: (dir) => {
				const idx = THEME_LABELS.findIndex((t) => t.value === settings().theme);
				const next = (idx + dir + THEME_LABELS.length) % THEME_LABELS.length;
				app.setTheme(THEME_LABELS[next].value);
			},
		},
		{
			id: "transparentBackground",
			label: "Transparent Background",
			kind: "toggle",
			display: () =>
				settings().transparentBackground ? "On" : "Off",
			help: () =>
				`Let the terminal's own background show through (no app background fill).\nType: toggle\nDefault: false\nCurrent: ${settings().transparentBackground ? "On" : "Off"}\nSpace/Enter to toggle.`,
			toggle: () =>
				app.updateSettings({
					transparentBackground: !settings().transparentBackground,
				}),
		},
		{
			id: "showSelectionMarker",
			label: "Selection Marker",
			kind: "toggle",
			display: () => (settings().showSelectionMarker ? "On" : "Off"),
			help: () =>
				`Show the ❯ marker on the focused row of every list (tabs, shows, episodes, results).\nType: toggle\nDefault: off\nCurrent: ${settings().showSelectionMarker ? "On" : "Off"}\nSpace/Enter to toggle.`,
			toggle: () =>
				app.updateSettings({
					showSelectionMarker: !settings().showSelectionMarker,
				}),
		},
		{
			id: "fontSize",
			label: "Font Size",
			kind: "number",
			display: () => `${settings().fontSize}px`,
			help: () =>
				`Terminal font size in pixels.\nType: number (10–20)\nDefault: 14\nCurrent: ${settings().fontSize}\nj/k to −/+1px.`,
			cycle: (dir) => {
				const next = Math.min(20, Math.max(10, settings().fontSize + dir));
				app.updateSettings({ fontSize: next });
			},
		},
		{
			id: "playbackSpeed",
			label: "Playback Speed",
			kind: "number",
			display: () => `${settings().playbackSpeed}x`,
			help: () =>
				`Default audio playback speed.\nType: number (0.5–2.0)\nDefault: 1.0\nCurrent: ${settings().playbackSpeed}\nj/k to −/+0.1.`,
			cycle: (dir) => {
				const next = Math.min(
					2,
					Math.max(0.5, settings().playbackSpeed + dir * 0.1),
				);
				app.updateSettings({ playbackSpeed: Number(next.toFixed(1)) });
			},
		},
		{
			id: "showExplicit",
			label: "Show Explicit",
			kind: "toggle",
			display: () => (prefs().showExplicit ? "On" : "Off"),
			help: () =>
				`Whether to list explicit episodes.\nType: toggle\nDefault: true\nCurrent: ${prefs().showExplicit}\nSpace/Enter to toggle.`,
			toggle: () =>
				app.updatePreferences({
					showExplicit: !prefs().showExplicit,
				}),
		},
		{
			id: "autoDownload",
			label: "Auto Download",
			kind: "toggle",
			display: () => (prefs().autoDownload ? "On" : "Off"),
			help: () =>
				`Download the ${prefs().autoDownloadCount} most recent episodes of your shows automatically (see Count/Scope below).\nType: toggle\nDefault: false\nCurrent: ${prefs().autoDownload ? "On" : "Off"}\nSpace/Enter to toggle.`,
			toggle: () => {
				app.updatePreferences({ autoDownload: !prefs().autoDownload });
				feedStore.runAutoDownload();
			},
		},
		{
			id: "autoDownloadCount",
			label: "Auto Download Count",
			kind: "number",
			display: () => `${prefs().autoDownloadCount} per show`,
			help: () =>
				`How many of the most recent episodes to auto-download per in-scope show.\nType: number (any positive integer)\nDefault: 2\nCurrent: ${prefs().autoDownloadCount}\nj/k to −/+1 · Enter to type a value.`,
			cycle: (dir) => {
				const next = Math.max(1, prefs().autoDownloadCount + dir);
				app.updatePreferences({ autoDownloadCount: next });
				feedStore.runAutoDownload();
			},
			renderEditor: () => (
				<NumberInputEditor
					label="Auto Download Count"
					value={() => prefs().autoDownloadCount}
					commit={(n) => {
						app.updatePreferences({ autoDownloadCount: n });
						feedStore.runAutoDownload();
					}}
				/>
			),
		},
		{
			id: "autoDownloadScope",
			label: "Auto Download Scope",
			kind: "select",
			display: () => scopeLabel(prefs().autoDownloadScope),
			help: () =>
				`Which shows auto-download applies to.\nAll: every subscribed show.\nNone: nothing.\nWhitelist: only the shows you add (in My Shows press ${"w"} on the focused show; or open the Whitelist item below).\nType: select\nDefault: all\nCurrent: ${scopeLabel(prefs().autoDownloadScope)}\nCycle with j/k; Enter to apply.`,
			cycle: (dir) => {
				const idx = SCOPE_LABELS.findIndex(
					(s) => s.value === prefs().autoDownloadScope,
				);
				const next =
					SCOPE_LABELS[(idx + dir + SCOPE_LABELS.length) % SCOPE_LABELS.length]
						.value;
				app.updatePreferences({ autoDownloadScope: next });
				feedStore.runAutoDownload();
			},
		},
		{
			id: "autoJumpToPlayer",
			label: "Auto Jump to Player",
			kind: "toggle",
			display: () => (prefs().autoJumpToPlayer ? "On" : "Off"),
			help: () =>
				`Jump to the Player view automatically when a podcast starts.\nType: toggle\nDefault: true\nCurrent: ${prefs().autoJumpToPlayer ? "On" : "Off"}\nSpace/Enter to toggle.`,
			toggle: () =>
				app.updatePreferences({
					autoJumpToPlayer: !prefs().autoJumpToPlayer,
				}),
		},
		{
			id: "episodeCacheMode",
			label: "Episode Cache Mode",
			kind: "select",
			display: () => cacheModeLabel(prefs().episodeCacheMode),
			help: () =>
				`How the Feed and My Shows episode lists are bounded.\nDate: keep episodes from the last N days (see Cache Days below); Fetch More reveals the next 2 weeks per press.\nCount: keep the N most recent episodes (see Cache Count below); Fetch More pages in 50-episode chunks.\nFetch More always pages beyond this bound — these episodes are volatile and don't persist.\nType: select\nDefault: date\nCurrent: ${cacheModeLabel(prefs().episodeCacheMode)}\nCycle with j/k; Enter to apply.`,
			cycle: (dir) => {
				const idx = CACHE_MODE_LABELS.findIndex(
					(s) => s.value === prefs().episodeCacheMode,
				);
				const next =
					CACHE_MODE_LABELS[
						(idx + dir + CACHE_MODE_LABELS.length) % CACHE_MODE_LABELS.length
					].value;
				app.updatePreferences({ episodeCacheMode: next });
			},
		},
		{
			id: "episodeCacheCount",
			label: "Episode Cache Count",
			kind: "number",
			display: () =>
				prefs().episodeCacheMode === "count"
					? `${prefs().episodeCacheCount} eps`
					: "(date mode)",
			help: () =>
				`Number of most-recent episodes to keep in the Feed/My Shows lists when mode is Count.\nType: number (any positive integer)\nDefault: 25\nCurrent: ${prefs().episodeCacheCount}\nj/k to −/+1 · Enter to type a value.`,
			cycle: (dir) => {
				const next = Math.max(1, prefs().episodeCacheCount + dir);
				app.updatePreferences({ episodeCacheCount: next });
			},
			renderEditor: () => (
				<NumberInputEditor
					label="Episode Cache Count"
					value={() => prefs().episodeCacheCount}
					commit={(n) => {
						app.updatePreferences({
							episodeCacheCount: Math.max(1, n),
						});
					}}
				/>
			),
		},
		{
			id: "episodeCacheDays",
			label: "Episode Cache Days",
			kind: "number",
			display: () =>
				prefs().episodeCacheMode === "date"
					? `${prefs().episodeCacheDays} days`
					: "(count mode)",
			help: () =>
				`Rolling window in days for the Feed/My Shows episode lists when mode is Date.\nType: number (1–365)\nDefault: 60\nCurrent: ${prefs().episodeCacheDays} days\nj/k to −/+5 · Enter to type a value.`,
			cycle: (dir) => {
				const next = Math.min(
					365,
					Math.max(1, prefs().episodeCacheDays + dir * 5),
				);
				app.updatePreferences({ episodeCacheDays: next });
			},
			renderEditor: () => (
				<NumberInputEditor
					label="Episode Cache Days"
					value={() => prefs().episodeCacheDays}
					commit={(n) => {
						app.updatePreferences({
							episodeCacheDays: Math.min(365, Math.max(1, n)),
						});
					}}
				/>
			),
		},
		{
			id: "fetchMore",
			label: "Fetch More",
			kind: "select",
			display: () => (prefs().fetchMoreMode === "auto" ? "Auto" : "Manual"),
			help: () =>
				`How the Feed and per-show episode lists load older episodes.\nManual: a "[Fetch More]" button at the bottom of the list.\nAuto: fetches automatically when reaching the bottom.\nType: select\nDefault: auto\nCurrent: ${prefs().fetchMoreMode === "auto" ? "Auto" : "Manual"}\nCycle with j/k; Enter to apply.`,
			cycle: (dir) => {
				const modes: Array<"manual" | "auto"> = ["manual", "auto"];
				const idx = modes.indexOf(prefs().fetchMoreMode ?? "auto");
				const next = modes[(idx + dir + modes.length) % modes.length];
				app.updatePreferences({ fetchMoreMode: next });
			},
		},
		{
			id: "refreshInterval",
			label: "Feed Refresh Interval",
			kind: "number",
			display: () => `${prefs().refreshIntervalMinutes} min`,
			help: () =>
				`How often subscribed feeds are re-fetched in the background, so new episodes appear without a restart or manual refresh (r).\nType: number (1–120 minutes)\nDefault: 30\nCurrent: ${prefs().refreshIntervalMinutes} min\nj/k to −/+5 · Enter to type a value.`,
			cycle: (dir) => {
				const next = Math.min(
					120,
					Math.max(1, prefs().refreshIntervalMinutes + dir * 5),
				);
				app.updatePreferences({ refreshIntervalMinutes: next });
			},
			renderEditor: () => (
				<NumberInputEditor
					label="Feed Refresh Interval (minutes)"
					value={() => prefs().refreshIntervalMinutes}
					commit={(n) => {
						app.updatePreferences({
							refreshIntervalMinutes: Math.min(120, n),
						});
					}}
				/>
			),
		},
	];

	// Whitelist management only appears while scope is set to "whitelist".
	if (prefs().autoDownloadScope === "whitelist") {
		items.push({
			id: "autoDownloadWhitelist",
			label: "Auto Download Whitelist",
			kind: "editor",
			display: () => `${prefs().autoDownloadWhitelist.length} shows`,
			help: () =>
				`Shows included in auto-download (scope: whitelist).\nSearch your subscribed shows; suggestions toggle in/out with Space.\nType: editor\nCurrent: ${prefs().autoDownloadWhitelist.length} shows`,
			renderEditor: () => <WhitelistEditor />,
		});
	}

	return items;
}

// ── Number editor ────────────────────────────────────────────────────────────
// Lets the user type any positive integer (Enter commits; Esc defocuses and
// j/k ±1 cycling takes over — SettingsPage's depth-2 step handler).

function NumberInputEditor(props: {
	label: string;
	value: () => number;
	commit: (n: number) => void;
}) {
	const { theme } = useTheme();
	const ref = useInputFocusNav();
	const [draft, setDraft] = createSignal(String(props.value()));
	const [error, setError] = createSignal<string | null>(null);

	const submit = () => {
		const n = Number(draft().trim());
		if (!Number.isInteger(n) || n < 1) {
			setError("Enter a whole number ≥ 1");
			return;
		}
		props.commit(n);
		setError(null);
	};

	return (
		<box flexDirection="column" padding={1} gap={1}>
			<text fg={theme.text}>
				<strong>{props.label}</strong>
			</text>
			<box flexDirection="row" gap={1} alignItems="center">
				<text fg={theme.textMuted}>Episodes per show:</text>
				<input
					ref={ref}
					value={draft()}
					onInput={(v) => {
						setDraft(v);
						setError(null);
					}}
					onSubmit={submit}
					focused
					width={8}
					textColor={theme.text}
					focusedTextColor={theme.accent}
				/>
			</box>
			<Show when={error()}>
				<text fg={theme.error}>{error()}</text>
			</Show>
			<text fg={theme.muted ?? theme.textMuted}>
				Type a number, Enter to apply · Esc to browse (j/k ±1) · h back
			</text>
		</box>
	);
}

// ── Whitelist editor ─────────────────────────────────────────────────────────
// Search field over subscribed shows + a navigable suggestion list. Space
// (toggle-select) toggles the focused show in/out of the whitelist; Enter
// does the same. While the input is focused, keys type; Esc (handled in the
// Shell) defocuses so j/k move the list.
//
// Transient UI state lives at module level so preference updates (which
// rebuild the item list) never reset the search or yank focus back into the
// input mid-browse.
//
// The nav.action listener is registered ONCE at module level, not per
// component instance: toggling a show updates preferences, which remounts
// the editor (SettingsPage re-resolves the item's renderEditor), and
// re-registering the listener via onMount/onCleanup during a bus emit
// mutates the handler set mid-iteration — the event bus then re-delivers to
// the fresh listener forever. A single stable listener guarded by an active
// flag sidesteps that entirely.

const [wlQuery, setWlQuery] = createSignal("");
const [wlCursor, setWlCursor] = createSignal(0);
const [wlTyping, setWlTyping] = createSignal(true);
let wlEditorActive = false;
// Indirection for refocusing the search input from the module-level nav.action
// listener (which cannot call useNavigation — that needs the provider).
let wlFocusInput: (() => void) | null = null;

function wlSuggestions(): Feed[] {
	const q = wlQuery().trim().toLowerCase();
	const all = useFeedStore().getFilteredFeeds();
	if (!q) return all;
	return all.filter((f) =>
		(f.customName || f.podcast.title).toLowerCase().includes(q),
	);
}

/** Keep the cursor inside the (possibly shrinking) suggestion list. */
function wlCursorClamped(): number {
	return Math.min(wlCursor(), Math.max(wlSuggestions().length - 1, 0));
}

function wlToggle(feedId: string): void {
	const app = useAppStore();
	const cur = app.state().preferences.autoDownloadWhitelist ?? [];
	const next = cur.includes(feedId)
		? cur.filter((id) => id !== feedId)
		: [...cur, feedId];
	app.updatePreferences({ autoDownloadWhitelist: next });
	useFeedStore().runAutoDownload();
}

const wlOnAction = (data: {
	action: KeybindActionName;
	tab: TABS;
	pane: PaneId;
	mode: NavMode;
}) => {
	// Fire at most once per dispatch: the editor is only ever open inside the
	// Settings tab's depth-2 pane, so scope on tab + pane and gate on the
	// mount flag (which flips during remounts without re-registering).
	if (!wlEditorActive) return;
	if (data.tab !== TABS.SETTINGS) return;
	if (data.pane !== DEPTH_CENTER_PANE) return;
	const list = wlSuggestions();
	if (list.length === 0) return;
	switch (data.action) {
		case "move-down":
			setWlCursor((c) => Math.min(c + 1, list.length - 1));
			break;
		case "move-up":
			setWlCursor((c) => Math.max(c - 1, 0));
			break;
		case "toggle-select":
		case "open":
			wlToggle(list[wlCursorClamped()].id);
			break;
		case "search":
			// `s` while browsing re-enters typing mode (mirrors SearchPage).
			wlFocusInput?.();
			break;
	}
};
on("nav.action", wlOnAction);

function WhitelistEditor() {
	const { theme } = useTheme();
	const nav = useNavigation();
	const feedStore = useFeedStore();
	const app = useAppStore();

	const whitelist = () => app.state().preferences.autoDownloadWhitelist ?? [];
	const inList = (feedId: string) => whitelist().includes(feedId);

	onMount(() => {
		wlEditorActive = true;
		// Restore the last typing/browsing mode across the remounts that
		// preference updates trigger. nav.inputFocused() drives the input's
		// focused prop (deterministic Esc-to-blur, same as SearchPage), so
		// keep the store in sync with the persisted module mode.
		nav.setInputFocused(wlTyping());
		wlFocusInput = () => nav.setInputFocused(true);
		onCleanup(() => {
			wlEditorActive = false;
			nav.setInputFocused(false);
			wlFocusInput = null;
		});
	});

	const focusNavRef = useInputFocusNav();
	const inputRef = (el: InputRenderable | null | undefined) => {
		focusNavRef(el);
		if (el) {
			// Sync the persisted mode with real focus changes so remounts
			// (e.g. after a toggle) restore the right state.
			el.on(RenderableEvents.FOCUSED, () => setWlTyping(true));
			el.on(RenderableEvents.BLURRED, () => setWlTyping(false));
		}
	};

	return (
		<box flexDirection="column" padding={1} gap={1}>
			<text fg={theme.text}>
				<strong>Auto Download Whitelist</strong>
			</text>
			<box flexDirection="row" gap={1} alignItems="center">
				<text fg={theme.textMuted}>Search:</text>
				<input
					ref={inputRef}
					value={wlQuery()}
					onInput={setWlQuery}
					focused={nav.inputFocused()}
					placeholder="Type to filter shows…"
					width={30}
					textColor={theme.text}
					focusedTextColor={theme.accent}
				/>
			</box>
			<Show when={wlSuggestions().length === 0}>
				<text fg={theme.muted ?? theme.textMuted}>
					No subscribed shows match.
				</text>
			</Show>
			<For each={wlSuggestions()}>
				{(feed, index) => {
					// While the input is focused (typing), no row shows the
					// accent highlight or `❯` — only the input is "in focus".
					const focused = () =>
						!nav.inputFocused() && index() === wlCursorClamped();
					const ref = useScrollIntoView(focused);
					const marker = useSelectionMarker();
					const bg = () => (focused() ? theme.primary : undefined);
					const fg = () => (focused() ? theme.surface : theme.text);
					return (
						<box
							ref={ref}
							flexDirection="row"
							gap={1}
							paddingRight={1}
							backgroundColor={bg()}
							onMouseDown={() => {
								nav.setActivePane(DEPTH_CENTER_PANE);
								setWlCursor(index());
								// Click toggles membership directly (works even
								// while typing, where Space is input text).
								wlToggle(feed.id);
							}}
						>
							<text fg={fg()}>{focused() ? marker() : " "}</text>
							<text fg={fg()}>{inList(feed.id) ? "●" : "○"}</text>
							<text fg={fg()}>
								{feed.customName || feed.podcast.title}
							</text>
						</box>
					);
				}}
			</For>
			<text fg={theme.muted ?? theme.textMuted}>
				Type to search · Esc to browse · j/k move · Space toggles · s to
				type · h back
			</text>
		</box>
	);
}
