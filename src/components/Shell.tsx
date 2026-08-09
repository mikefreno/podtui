/**
 * Shell — yazi-style application chrome.
 *
 * Renders the active page (which owns its own three-column parent | current |
 * preview panes) full-width, with a bottom status/command bar that also
 * carries the tab strip. A single `useKeyboard` router translates keystrokes
 * (via the sequence-aware keybind matcher) into actions: the unified router
 * in `@/utils/dispatch` handles tabs (digits `1`-`6`, `[`/`]`), h/l depth
 * drill/pop + fixed-pane swipe, modes, audio, quit, help, and command; the
 * pane/list ones are dispatched to the active page over the `nav.action`
 * event bus. There is no sidebar pane.
 */

import { createSignal, Show, For } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { useTheme } from "@/context/ThemeContext";
import { useKeybinds, type KeybindActionName } from "@/context/KeybindContext";
import { useNavigation, NavMode } from "@/context/NavigationContext";
import { useAudio } from "@/hooks/useAudio";
import { useAudioNavStore } from "@/stores/audio-nav";
import { useFeedStore } from "@/stores/feed";
import { useAppStore } from "@/stores/app";
import { useToast } from "@/ui/toast";
import { emit, on } from "@/utils/event-bus";
import { LayerGraph } from "@/utils/layer-graph";
import { TABS, TabPaneCount } from "@/utils/navigation";
import { createDispatcher } from "@/utils/dispatch";
import { TabListPane } from "@/components/TabPanel";
import { PaneRow } from "@/components/PaneRow";

const TAB_LABEL: Record<TABS, string> = {
	[TABS.FEED]: "Feed",
	[TABS.MYSHOWS]: "My Shows",
	[TABS.DISCOVER]: "Discover",
	[TABS.SEARCH]: "Search",
	[TABS.PLAYER]: "Player",
	[TABS.SETTINGS]: "Settings",
};

export function Shell() {
	const theme = useTheme();
	const t = theme.theme;
	const nav = useNavigation();
	const k = useKeybinds();
	const audio = useAudio();
	const audioNav = useAudioNavStore();
	const toast = useToast();
	const feedStore = useFeedStore();

	const [showHelp, setShowHelp] = createSignal(false);

	// ── Auto jump to Player on podcast start ───────────────────────────────────
	// Honor the `autoJumpToPlayer` preference: when a NEW episode starts (see
	// "player.started" — distinct from "player.play", which also fires on
	// resume), switch to the Player tab and drop into its content pane.
	on("player.started", () => {
		const app = useAppStore();
		if (app.state().preferences.autoJumpToPlayer) {
			nav.setActiveTab(TABS.PLAYER);
			nav.enterTabContent(); // PLAYER is a depth-tab — enter its content.
		}
	});

	/** Play the episode adjacent (offset ±1) to the currently-playing one,
	 *  within its feed's episode list. Updates audio-nav context accordingly. */
	function advanceEpisode(offset: number) {
		const cur = audio.currentEpisode();
		if (!cur) {
			toast.show({ message: "Nothing playing", variant: "warning" });
			return;
		}
		const pid = audioNav.getPodcastId();
		const feeds = feedStore.getFilteredFeeds();
		const feed =
			feeds.find((f) => f.podcast.id === pid) ??
			feeds.find((f) => f.episodes.some((e) => e.id === cur.id));
		if (!feed) {
			toast.show({ message: "Show not found", variant: "warning" });
			return;
		}
		const eps = [...feed.episodes].sort(
			(a, b) => b.pubDate.getTime() - a.pubDate.getTime(),
		);
		const idx = eps.findIndex((e) => e.id === cur.id);
		const next = eps[idx + offset];
		if (!next) {
			toast.show({
				message: offset > 0 ? "No next episode" : "No previous episode",
				variant: "warning",
			});
			return;
		}
		audio.play(next).catch(() => {});
		audioNav.next(eps.length - 1 - (idx + offset) >= 0 ? idx + offset : idx);
		toast.show({ message: `♪ ${next.title}`.slice(0, 60), variant: "info" });
	}

	// ── Command bar dispatch ────────────────────────────────────────────────────
	const COMMANDS: Record<string, (arg: string) => void> = {
		quit: () => process.exit(0),
		exit: () => process.exit(0),
		q: () => process.exit(0),
		refresh: () =>
			emit("nav.action", {
				action: "refresh",
				tab: nav.activeTab(),
				pane: nav.activePane(),
				mode: nav.mode(),
			}),
		r: () =>
			emit("nav.action", {
				action: "refresh",
				tab: nav.activeTab(),
				pane: nav.activePane(),
				mode: nav.mode(),
			}),
		play: () => audio.togglePlayback().catch(() => {}),
		pause: () => audio.togglePlayback().catch(() => {}),
		p: () => audio.togglePlayback().catch(() => {}),
		next: () => advanceEpisode(1),
		n: () => advanceEpisode(1),
		prev: () => advanceEpisode(-1),
		seek: (arg) => {
			const n = Number(arg) || 0;
			audio.seek(n).catch(() => {});
		},
		feed: () => nav.setActiveTab(TABS.FEED),
		f: () => nav.setActiveTab(TABS.FEED),
		shows: () => nav.setActiveTab(TABS.MYSHOWS),
		myshows: () => nav.setActiveTab(TABS.MYSHOWS),
		discover: () => nav.setActiveTab(TABS.DISCOVER),
		d: () => nav.setActiveTab(TABS.DISCOVER),
		search: () => nav.setActiveTab(TABS.SEARCH),
		player: () => nav.setActiveTab(TABS.PLAYER),
		settings: () => nav.setActiveTab(TABS.SETTINGS),
		set: () => nav.setActiveTab(TABS.SETTINGS),
		help: () => setShowHelp((v) => !v),
		h: () => setShowHelp((v) => !v),
	};

	function runCommand(raw: string) {
		const cmd = raw.trim();
		if (!cmd) return;
		const name = cmd.split(/\s+/)[0].toLowerCase();
		const arg = cmd.slice(name.length).trim();
		const unknownCommand = () => {
			nav.setCommandError(`unknown command: ${name}`);
			// re-enter command mode so the user sees the error + can correct
			nav.enterCommand();
			nav.setCommandBuffer(cmd);
		};
		(COMMANDS[name] ?? unknownCommand)(arg);
	}

	// ── Command-mode key handling ───────────────────────────────────────────────
	function handleCommandKey(evt: any) {
		if (k.match("escape", evt) || evt.name === "ctrl-c") {
			evt.preventDefault();
			nav.exitCommand();
			return;
		}
		if (evt.name === "return" || evt.name === "enter") {
			evt.preventDefault();
			const cmd = nav.commandBuffer();
			runCommand(cmd);
			nav.exitCommand();
			return;
		}
		if (evt.name === "backspace") {
			evt.preventDefault();
			const buf = nav.commandBuffer();
			if (buf.length === 0) {
				nav.exitCommand();
				return;
			}
			nav.backspaceCommand();
			return;
		}
		// printable char
		if (evt.name && evt.name.length === 1 && !evt.ctrl && !evt.meta) {
			evt.preventDefault();
			nav.appendCommand(evt.name);
			return;
		}
	}

	// ── Unified router (normal + visual) ───────────────────────────────────────
	const { dispatch } = createDispatcher({
		nav,
		audio: {
			togglePlayback: audio.togglePlayback,
			seekRelative: audio.seekRelative,
		},
		k,
		setShowHelp,
		advanceEpisode,
	});

	useKeyboard(
		(evt: any) => {
			// Input fields (search boxes, dialogs) own their keys — except Escape,
			// which defocuses the input so j/k/h navigation resumes (search: h back
			// to the tab root, j/k to move the recent-searches list).
			if (nav.inputFocused() && nav.mode() !== NavMode.COMMAND) {
				if (evt.name === "escape") {
					evt.preventDefault();
					nav.setInputFocused(false);
				}
				return;
			}
			if (nav.mode() === NavMode.COMMAND) {
				handleCommandKey(evt);
				return;
			}
			const action = k.tryMatch(evt);
			if (action) dispatch(action, evt);
		},
		{ release: false },
	);

	// ── Status bar fragments ──────────────────────────────────────────────────
	const nowPlaying = () => {
		const ep = audio.currentEpisode();
		if (!ep) return null;
		const title = ep.title.length > 40 ? ep.title.slice(0, 38) + "…" : ep.title;
		return `♪ ${title}`;
	};
	const modeLabel = () =>
		nav.mode() === NavMode.NORMAL ? "" : `-- ${nav.mode()} --`;
	const pendingLabel = () =>
		k
			.pending()
			.map((s) => s.key)
			.join(" ");

	return (
		<box
			flexDirection="column"
			width="100%"
			height="100%"
			backgroundColor={t.surface}
		>
			{/* ── Middle row: tab list (pane 0) + active tab content (panes 1..n) ─ */}
			<box flexDirection="row" flexGrow={1} width="100%">
				<Show
					when={nav.atRootTab()}
					fallback={
						<box flexGrow={1} width="100%">
							{LayerGraph[nav.activeTab()]()}
						</box>
					}
				>
					{/* app root: the tab list is the CURRENT pane, nothing in UP */}
					<PaneRow
						parent={
							<box padding={1}>
								<text fg={t.textMuted}>—</text>
							</box>
						}
						current={<TabListPane />}
						preview={
							<box padding={1}>
								<text fg={t.textMuted}>j/k move · l/Enter open a tab</text>
							</box>
						}
						parentLabel="Up"
						currentLabel="Tabs"
						previewLabel=""
						focused
					/>
				</Show>
			</box>
			{/* ── Bottom status / command bar ─────────────────────────────────────── */}
			<box
				flexDirection="row"
				height={1}
				width="100%"
				backgroundColor={t.backgroundPanel ?? t.background}
			>
				<Show
					when={nav.mode() === NavMode.COMMAND}
					fallback={
						<>
							<text fg={t.accent} paddingLeft={1}>
								{modeLabel()}
							</text>
							<text fg={t.textMuted} paddingLeft={1}>
								{nav.atRootTab()
									? "Tabs · root"
									: `${TAB_LABEL[nav.activeTab()]} · ${
											nav.isDepthTab()
												? `depth ${nav.currentDepth()}`
												: `pane ${nav.activePane()}/${TabPaneCount[nav.activeTab()]}`
										}`}
							</text>
							<Show when={nav.selectedIds().length > 0}>
								<text fg={t.warning} paddingLeft={1}>
									● {nav.selectedIds().length}
								</text>
							</Show>
							<Show when={nowPlaying()}>
								<text fg={t.primary} paddingLeft={1}>
									{nowPlaying()}
								</text>
							</Show>
							<box flexGrow={1} />
							<text fg={t.textMuted} paddingRight={1}>
								{pendingLabel()}
							</text>
							<text fg={t.textMuted} paddingRight={1}>
								~
							</text>
						</>
					}
				>
					<text fg={t.accent} paddingLeft={1}>
						:
					</text>
					<text fg={t.text}>{nav.commandBuffer()}</text>
					<text fg={t.textMuted}>▏</text>
					<Show when={nav.commandError()}>
						<text fg={t.error} paddingLeft={1}>
							{nav.commandError()}
						</text>
					</Show>
				</Show>
			</box>
			{/* ── Help overlay ─────────────────────────────────────────────────────── */}
			<Show when={showHelp()}>
				<HelpOverlay
					onClose={() => setShowHelp(false)}
					sections={helpSections(k)}
					theme={t as any}
				/>
			</Show>
		</box>
	);
}

function helpSections(k: ReturnType<typeof useKeybinds>) {
	const p = (a: KeybindActionName) => k.print(a);
	return [
		{
			group: "Move",
			items: [
				["j/k", "move"],
				["J/K", "5 lines"],
				["ctrl-d/u", "half page"],
				["gg/G", "top/bottom"],
			],
		},
		{
			group: "Panes",
			items: [
				["j/k", "switch tab (tab panel)"],
				["l/enter", "enter tab content"],
				["h", "back to tab panel"],
				["1-6 / [ ]", "switch tabs"],
				[":", "command"],
				["~", "help"],
			],
		},
		{
			group: "Select",
			items: [
				["space", "toggle"],
				["v", "visual"],
				["ctrl-a", "all"],
				["esc", "clear"],
			],
		},
		{
			group: "Audio",
			items: [
				[p("audio-toggle"), "play/pause"],
				[p("audio-next"), "next"],
				[p("audio-seek-forward"), "fwd 10s"],
				[p("audio-seek-backward"), "back 10s"],
			],
		},
		{
			group: "List",
			items: [
				["enter", "open"],
				["r", "refresh"],
				["s", "search"],
				["f", "filter"],
				[",", "sort"],
				[".", "hidden"],
			],
		},
	];
}

function HelpOverlay(props: {
	onClose: () => void;
	sections: { group: string; items: string[][] }[];
	theme: any;
}) {
	useKeyboard((evt: any) => {
		if (k_match_escape(evt)) {
			evt.preventDefault();
			props.onClose();
		}
	});
	const th = props.theme;
	return (
		<box
			position="absolute"
			top={2}
			left={0}
			width="100%"
			alignItems="center"
			backgroundColor="rgba(0,0,0,160)"
			onMouseUp={() => props.onClose()}
		>
			<box
				flexDirection="column"
				border
				borderColor={th.border}
				backgroundColor={th.backgroundPanel ?? th.background}
				padding={1}
				width={60}
				onMouseUp={(e: any) => e.stopPropagation()}
			>
				<text fg={th.accent}>
					Yazi-style keybinds — press ~ or Esc to close
				</text>
				<For each={props.sections}>
					{(sec) => (
						<box flexDirection="column" marginTop={1}>
							<text fg={th.textSecondary}>{sec.group}</text>
							<For each={sec.items}>
								{(it) => (
									<box flexDirection="row" gap={2}>
										<text fg={th.accent}>{String(it[0]).padEnd(14, " ")}</text>
										<text fg={th.textPrimary ?? th.text}>{it[1]}</text>
									</box>
								)}
							</For>
						</box>
					)}
				</For>
				<box marginTop={1}>
					<text fg={th.textMuted}>
						Edit ~/.config/podtui/keybinds.jsonc to remap.
					</text>
				</box>
			</box>
		</box>
	);
}

function k_match_escape(evt: any): boolean {
	return (
		evt.name === "escape" || evt.name === "~" || (evt.ctrl && evt.name === "[")
	);
}

// Re-export Episode type for callers building pane trees.
export type { Episode } from "@/types/episode";
