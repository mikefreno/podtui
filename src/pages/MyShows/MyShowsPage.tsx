/**
 * MyShowsPage — yazi depth-stack view of subscribed shows.
 *
 *   depth 0 (current) — subscribed shows. Parent pane shows the muted
 *                       placeholder (1/5 slot kept).
 *   depth 1 (current) — episodes of the drilled show. Parent pane = shows.
 *   preview            — detail of the hovered item in the current column.
 *
 * Depth 0's shows list and depth 1's episode list both end with a
 * "[Fetch More]" row that loads the next batch of episodes — depth 0 for
 * every subscribed show, depth 1 for the drilled show.
 *
 * Renders entirely through `<PaneRow>`; no bespoke 3-column flexbox JSX
 * remains. `l`/Enter drills in (show → episodes); `h` pops a depth (noop at
 * 0). j/k move only within the current column.
 */

import { createMemo, For, Show, onMount, onCleanup } from "solid-js";
import type { RGBA } from "@opentui/core";
import { useFeedStore } from "@/stores/feed";
import { useDownloadStore } from "@/stores/download";
import { useAppStore } from "@/stores/app";
import { DownloadStatus } from "@/types/episode";
import { useTheme } from "@/context/ThemeContext";
import { useAudioNavStore, AudioSource } from "@/stores/audio-nav";
import {
	useNavigation,
	NavMode,
	DEPTH_CENTER_PANE,
	type PaneId,
	type DepthFrame,
} from "@/context/NavigationContext";
import { useAudio } from "@/hooks/useAudio";
import { on, off } from "@/utils/event-bus";
import { supportsNerdFonts } from "@/utils/nerd-fonts";
import type { KeybindActionName } from "@/context/KeybindContext";
import type { Episode, DownloadedEpisode } from "@/types/episode";
import type { Feed } from "@/types/feed";
import {
	EpisodeRow,
	FetchMoreRow,
	EpisodePreview,
	FetchMorePreview,
	formatDate,
} from "@/components/EpisodeList";
import { PaneRow } from "@/components/PaneRow";
import { TabListPane } from "@/components/TabPanel";
import { useScrollIntoView } from "@/hooks/useScrollIntoView";
import { useSelectionMarker } from "@/hooks/useSelectionMarker";

// ── render components ────────────────────────────────────────────────────────
// Depth-0 rows (subscribed shows, unsubscribed-show downloads) and their
// preview panes are My Shows-specific; episode rows/previews are shared with
// the Feed page (see EpisodeList.tsx).

/** A subscribed-show row (depth 0). */
function ShowRow(props: {
	feed: Feed;
	title: string;
	index: () => number;
	focused: () => number;
	active: () => boolean;
	marker: () => string;
	wlScope: () => boolean;
	wlInList: () => boolean;
	onMouseDown: () => void;
}) {
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const ref = useScrollIntoView(() => props.index() === props.focused());
	const isFocused = () => props.index() === props.focused();
	const bg = () =>
		isFocused() && props.active()
			? theme.primary
			: isFocused()
				? theme.border
				: undefined;
	const fg = () =>
		isFocused() && props.active()
			? theme.surface
			: isFocused()
				? theme.selectedListItemText ?? theme.text
				: theme.text;
	return (
		<box
			ref={ref}
			flexDirection="row"
			gap={1}
			paddingRight={1}
			backgroundColor={bg()}
			onMouseDown={props.onMouseDown}
		>
			<text flexShrink={0} fg={fg()}>
				{isFocused() ? props.marker() : " "}
			</text>
			{/* Long titles truncate with middle-ellipsis instead of wrapping —
			    a wrapped title grows the row to 2+ lines and shifts every row
			    below (see EpisodeList for the same guard). The episode-count
			    and watchlist cells are flexShrink=0 so they never shrink or
			    wrap; the flexible title takes the remaining width. */}
			<text wrapMode="none" truncate fg={fg()}>
				{props.title}
			</text>
			<text flexShrink={0} fg={isFocused() ? theme.surface : muted()}>
				({props.feed.episodes.length})
			</text>
			<Show when={props.wlScope()}>
				<text
					flexShrink={0}
					fg={
						isFocused()
							? theme.surface
							: props.wlInList()
								? theme.warning
								: muted()
					}
				>
					{props.wlInList() ? "●" : "○"}
				</text>
			</Show>
		</box>
	);
}

/** An unsubscribed-show download row (depth 0, below the shows list). */
function UnsubscribedRow(props: {
	d: DownloadedEpisode;
	index: () => number;
	focused: () => number;
	active: () => boolean;
	marker: () => string;
	downloadLabel: () => string;
	downloadColor: () => RGBA;
	onMouseDown: () => void;
}) {
	const { theme } = useTheme();
	const ref = useScrollIntoView(() => props.index() === props.focused());
	const isFocused = () => props.index() === props.focused();
	const bg = () =>
		isFocused() && props.active()
			? theme.primary
			: isFocused()
				? theme.border
				: undefined;
	const fg = () =>
		isFocused() && props.active()
			? theme.surface
			: isFocused()
				? theme.selectedListItemText ?? theme.text
				: theme.text;
	return (
		<box
			ref={ref}
			flexDirection="column"
			gap={0}
			paddingRight={1}
			backgroundColor={bg()}
			onMouseDown={props.onMouseDown}
		>
			<box flexDirection="row" gap={1}>
				<text flexShrink={0} fg={fg()}>
					{isFocused() ? props.marker() : " "}
				</text>
				<text wrapMode="none" truncate fg={fg()}>
					{props.d.episodeTitle ?? props.d.episodeId}
				</text>
				<Show when={props.downloadLabel()}>
					<text flexShrink={0} fg={props.downloadColor()}>
						{props.downloadLabel()}
					</text>
				</Show>
			</box>
			<box paddingLeft={2}>
				<text
					wrapMode="none"
					truncate
					fg={isFocused() ? theme.surface : theme.textSecondary}
				>
					{props.d.podcastTitle ?? props.d.feedId}
				</text>
			</box>
		</box>
	);
}

/** Depth-0 preview: the hovered subscribed show. */
function ShowPreview(props: {
	show: () => Feed;
	title: () => string;
	hint: () => string;
}) {
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const show = props.show;
	return (
		<box flexDirection="column" gap={1} padding={1}>
			<text fg={theme.textPrimary ?? theme.text}>
				<strong>{props.title()}</strong>
			</text>
			<Show when={show().podcast.author}>
				<text fg={muted()}>by {show().podcast.author}</text>
			</Show>
			<text fg={theme.textSecondary}>{show().episodes.length} episodes</text>
			<text fg={muted()}>
				{show().podcast.description?.slice(0, 400) ?? "No description."}
			</text>
			<box height={1} />
			<text fg={muted()}>{props.hint()}</text>
		</box>
	);
}

/** Depth-0 preview: the hovered unsubscribed-show download. */
function UnsubscribedPreview(props: {
	d: () => DownloadedEpisode;
	downloadLabel: () => string;
	downloadColor: () => RGBA;
}) {
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const d = props.d;
	return (
		<box flexDirection="column" gap={1} padding={1}>
			<text fg={theme.textPrimary ?? theme.text}>
				<strong>{d().episodeTitle ?? d().episodeId}</strong>
			</text>
			<text fg={theme.textSecondary}>{d().podcastTitle ?? d().feedId}</text>
			<box flexDirection="row" gap={2}>
				<Show when={d().pubDate}>
					<text fg={theme.info}>{formatDate(new Date(d().pubDate!))}</text>
				</Show>
				<Show when={props.downloadLabel()}>
					<text fg={props.downloadColor()}>
						{props.downloadLabel()}
					</text>
				</Show>
			</box>
			<text fg={muted()}>
				Downloaded from episode search — the show is not subscribed.
			</text>
			<box height={1} />
			<text fg={muted()}>enter: play · D: delete download · h: back</text>
		</box>
	);
}

export const MyShowsPaneCount = 1;

export function MyShowsPage() {
	// Static: detection never changes mid-session.
	const nerd = supportsNerdFonts();
	const feedStore = useFeedStore();
	const downloadStore = useDownloadStore();
	const app = useAppStore();
	const audioNav = useAudioNavStore();
	const audio = useAudio();
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const nav = useNavigation();
	const marker = useSelectionMarker();

	const stack = nav.depthStack;
	const depth = nav.currentDepth;
	const focus = (d: number = depth()) => nav.depthFocus(d);

	const shows = () => feedStore.getFilteredFeeds();

	// Downloads of shows that are NOT subscribed (made from episode search) —
	// listed as their own section under the shows list. Reads feeds() so an
	// entry drops out the moment the user subscribes to its show.
	const unsubs = () => downloadStore.getUnsubscribedDownloads();

	/** True while some subscribed show has more episodes to load — shows the
	 *  depth-0 "[Fetch More]" row. */
	const showLoadMore = () => feedStore.hasMoreAcrossAll();
	const depth0Count = () =>
		shows().length + unsubs().length + (showLoadMore() ? 1 : 0);
	const focusedRow0 = () =>
		depth0Count() === 0 ? 0 : Math.min(focus(0), depth0Count() - 1);
	/** True while the depth-0 cursor sits on the "[Fetch More]" row. */
	const focusedOnMore0 = () =>
		showLoadMore() && focusedRow0() === shows().length + unsubs().length;
	const focusedShowIdx = () =>
		focusedOnMore0()
			? -1
			: Math.min(focusedRow0(), Math.max(shows().length - 1, 0));
	/** True when the depth-0 cursor sits on an unsubscribed-show download
	 *  row (past the shows list). */
	const focusedOnUnsub = () =>
		!focusedOnMore0() &&
		depth() === 0 &&
		focusedRow0() >= shows().length &&
		unsubs().length > 0;
	const focusedUnsub = (): DownloadedEpisode | undefined => {
		if (!focusedOnUnsub()) return undefined;
		return unsubs()[
			Math.min(focusedRow0() - shows().length, unsubs().length - 1)
		];
	};
	const selectedShow = (): Feed | undefined => {
		if (focusedOnUnsub() || focusedOnMore0()) return undefined;
		return shows()[focusedShowIdx()];
	};

	// depth-1 frame ctx = the drilled feed id
	const drilledShowId = (): string => stack()[1]?.ctx ?? "";
	const episodes = createMemo<Episode[]>(() => {
		if (depth() < 1) return [];
		const id = drilledShowId();
		const show = shows().find((s) => s.id === id);
		if (!show) return [];
		return [...show.episodes].sort(
			(a, b) => b.pubDate.getTime() - a.pubDate.getTime(),
		);
	});
	// ── Fetch More ───────────────────────────────────────────────────────────
	// A "[Fetch More]" row at the bottom of a drilled show's episode list
	// advances that show's loaded window by 50 episodes — the per-show
	// counterpart to the Feed page's row (which loads every feed).
	const showFetchMore = () =>
		depth() >= 1 &&
		!!drilledShowId() &&
		feedStore.hasMoreEpisodes(drilledShowId());
	const rowCount = () => episodes().length + (showFetchMore() ? 1 : 0);
	const focusedRow = () =>
		rowCount() === 0 ? 0 : Math.min(focus(1), rowCount() - 1);
	const focusedOnMore = () =>
		showFetchMore() && focusedRow() === episodes().length;
	// -1 while the Fetch More row is focused so no episode row renders the
	// cursor/highlight (the button is the focused row, not the last episode).
	const focusedEpIdx = () =>
		focusedOnMore()
			? -1
			: Math.min(focusedRow(), Math.max(episodes().length - 1, 0));
	const focusedEpisode = () =>
		focusedOnMore() ? undefined : episodes()[focusedEpIdx()];

	// ── Render window ────────────────────────────────────────────────────────
	// The drilled show's list grows deep after repeated fetch-more presses;
	// rendering every row per frame froze the UI. Render only a bounded slice
	// around the focus (real indexes preserved) — the scrollbox still keeps
	// the focused row in view. Spacers above/below the window restore the
	// full content height so the scrollbar tracks the real list.
	// Each episode row is 2 lines tall (title, date) — no subtitle here.
	const LIST_WINDOW = 30;
	const ROW_HEIGHT = 2;
	const listWindow = createMemo<[number, number]>(() => {
		const len = episodes().length;
		// Focusing the Fetch More button keeps the window anchored at the
		// last episode — no jump when the focus crosses onto the button.
		const f = focusedOnMore() ? len - 1 : focusedEpIdx();
		return [
			Math.max(0, f - LIST_WINDOW),
			Math.min(len, f + LIST_WINDOW + 1),
		];
	});
	const visibleEpisodes = createMemo(() => {
		const [start, end] = listWindow();
		return episodes().slice(start, end);
	});

	const curLen = () => (depth() === 0 ? depth0Count() : rowCount());

	const ensureFocus = () => {
		if (depth() === 0 && depth0Count() > 0 && focus(0) >= depth0Count())
			nav.setDepthFocus(depth0Count() - 1, 0);
		if (depth() >= 1 && rowCount() > 0 && focus(1) >= rowCount())
			nav.setDepthFocus(rowCount() - 1, 1);
	};
	onMount(ensureFocus);

	onMount(() => {
		nav.registerResolver(`${nav.activeTab()}:${DEPTH_CENTER_PANE}`, (i) => {
			if (depth() === 0) {
				if (i < shows().length) return shows()[i]?.id;
				return unsubs()[i - shows().length]?.episodeId;
			}
			return episodes()[i]?.id;
		});
	});

	// ── helpers ─────────────────────────────────────────────────────────────────
	const downloadLabel = (id: string) => {
		switch (downloadStore.getDownloadStatus(id)) {
			case DownloadStatus.QUEUED:
				return "[Q]";
			case DownloadStatus.DOWNLOADING:
				return `[${downloadStore.getDownloadProgress(id)}%]`;
			case DownloadStatus.COMPLETED:
				return "[DL]";
			case DownloadStatus.FAILED:
				return "[ERR]";
			default:
				return "";
		}
	};
	const downloadColor = (id: string) => {
		switch (downloadStore.getDownloadStatus(id)) {
			case DownloadStatus.QUEUED:
				return theme.warning;
			case DownloadStatus.DOWNLOADING:
				return theme.primary;
			case DownloadStatus.COMPLETED:
				return theme.success;
			case DownloadStatus.FAILED:
				return theme.error;
			default:
				return muted();
		}
	};
	const playEpisode = (ep: Episode) => {
		audio.play(ep).catch(() => {});
		audioNav.setSource(AudioSource.MY_SHOWS, selectedShow()?.podcast.id);
	};

	/** Stream an unsubscribed-show download. The record carries only what was
	 *  persisted at download time, so a minimal Episode is reconstructed. */
	const playUnsubscribedDownload = (d: DownloadedEpisode) => {
		audio
			.play({
				id: d.episodeId,
				podcastId: d.feedId,
				title: d.episodeTitle ?? d.episodeId,
				description: "",
				audioUrl: d.audioUrl ?? "",
				duration: 0,
				pubDate: d.pubDate ? new Date(d.pubDate) : new Date(),
			})
			.catch(() => {});
		audioNav.setSource(AudioSource.SEARCH, d.feedId);
	};

	// ── drill / open ───────────────────────────────────────────────────────────
	function open() {
		if (depth() === 0) {
			if (focusedOnMore0()) {
				feedStore.loadMoreAllFeeds().catch(() => {});
				return;
			}
			const d = focusedUnsub();
			if (d) {
				playUnsubscribedDownload(d);
				return;
			}
			const show = selectedShow();
			if (!show) return;
			nav.pushDepth({ kind: "episodes", ctx: show.id, focus: 0 } as DepthFrame);
			nav.setActivePane(DEPTH_CENTER_PANE);
			audioNav.setSource(AudioSource.MY_SHOWS, show.podcast.id);
			return;
		}
		if (depth() >= 1) {
			if (focusedOnMore()) {
				feedStore.loadMoreEpisodes(drilledShowId()).catch(() => {});
				return;
			}
			const ep = focusedEpisode();
			if (ep) playEpisode(ep);
		}
	}

	// ── nav.action ──────────────────────────────────────────────────────────────
	const PAGE_ACTIONS: Partial<Record<KeybindActionName, () => void>> = {
		"move-down": () => step(1),
		"move-up": () => step(-1),
		"jump-down": () => step(5),
		"jump-up": () => step(-5),
		"page-down": () => step(10),
		"page-up": () => step(-10),
		"goto-top": () => nav.gotoIndex(0, curLen()),
		"goto-bottom": () => nav.gotoIndex(curLen() - 1, curLen()),
		open: () => open(),
		"toggle-select": () => {
			if (depth() >= 1) {
				const ep = focusedEpisode();
				if (ep) nav.toggleSelected(ep.id);
			}
		},
		download: () => {
			if (depth() < 1) return;
			const ep = focusedEpisode();
			if (ep) downloadStore.startDownload(ep, drilledShowId());
		},
		"delete-download": () => {
			if (depth() === 0) {
				const d = focusedUnsub();
				if (d) {
					downloadStore.cancelDownload(d.episodeId);
					downloadStore.removeDownload(d.episodeId).catch(() => {});
				}
				return;
			}
			if (depth() < 1) return;
			const ep = focusedEpisode();
			if (!ep) return;
			const id = ep.id;
			if (downloadStore.getDownloadStatus(id) === DownloadStatus.NONE) return;
			downloadStore.cancelDownload(id);
			downloadStore.removeDownload(id).catch(() => {});
		},
		"whitelist-toggle": () => {
			const prefs = app.state().preferences;
			if (prefs.autoDownloadScope !== "whitelist") return;
			// depth 0: the focused show; depth ≥1: the drilled show.
			const id = depth() >= 1 ? drilledShowId() : selectedShow()?.id;
			if (!id) return;
			const cur = prefs.autoDownloadWhitelist ?? [];
			const next = cur.includes(id)
				? cur.filter((x) => x !== id)
				: [...cur, id];
			app.updatePreferences({ autoDownloadWhitelist: next });
			feedStore.runAutoDownload();
		},
		refresh: () => {
			const show = selectedShow();
			if (show) feedStore.refreshFeed(show.id).catch(() => {});
		},
		unsubscribe: () => {
			if (depth() !== 0) return;
			const show = selectedShow();
			if (show) {
				// unsubscribe = remove feed + purge its downloaded files
				feedStore.removeFeed(show.id);
				downloadStore.removeDownloadsForFeed(show.id).catch(() => {});
				ensureFocus();
			}
		},
	};
	function step(delta: number) {
		nav.move(delta, curLen());
	}
	const onAction = (data: {
		action: KeybindActionName;
		pane: PaneId;
		mode: NavMode;
	}) => {
		if (data.pane !== DEPTH_CENTER_PANE) return;
		if (nav.activePane() !== DEPTH_CENTER_PANE) return;
		ensureFocus();
		PAGE_ACTIONS[data.action]?.();
	};
	onMount(() => {
		on("nav.action", onAction);
		onCleanup(() => off("nav.action", onAction));
	});

	// ── render ──────────────────────────────────────────────────────────────────
	const isActive = () => nav.activePane() === DEPTH_CENTER_PANE;
	const showTitle = (f: Feed) => f.customName || f.podcast.title;

	const currentLabel = () =>
		depth() === 0
			? `Shows (${shows().length})${
					unsubs().length > 0 ? ` · Unsub DL (${unsubs().length})` : ""
				}`
			: `${selectedShow() ? showTitle(selectedShow()!) : "Episodes"} · ${episodes().length}`;

	// ── parent pane: previous-depth list (muted/blank at depth 0) ─────────────
	// Stable <Show> gate (not a ternary root swap) so the parent list
	// mounts/unmounts cleanly on depth change.
	const parentContent = () => (
		<Show when={depth() >= 1} fallback={<TabListPane muted />}>
			<For each={shows()}>
				{(feed, index) => {
					const lf = () => nav.depthFocus(0);
					const ref = useScrollIntoView(() => index() === lf());
					const focused = () => index() === lf();
					const fg = () =>
						focused()
							? theme.selectedListItemText ?? theme.text
							: theme.text;
					return (
						<box
							ref={ref}
							flexDirection="row"
							gap={1}
							paddingRight={1}
							backgroundColor={focused() ? theme.border : undefined}
						>
							<text flexShrink={0} fg={fg()}>
								{focused() ? marker() : " "}
							</text>
							{/* 20%-wide parent pane truncates hard — same
							    middle-ellipsis guard as the depth-0 rows. */}
							<text wrapMode="none" truncate fg={fg()}>
								{showTitle(feed)}
							</text>
							<text flexShrink={0} fg={muted()}>
								({feed.episodes.length})
							</text>
						</box>
					);
				}}
			</For>
		</Show>
	);

	// ── current pane: the current-depth list ───────────────────────────────────
	const currentContent = () => (
		<>
			{/* depth 0: shows — stable sibling <Show> so the swap disposes cleanly */}
			<Show when={depth() === 0}>
				<Show
					when={depth0Count() > 0}
					fallback={
						<box padding={1}>
							<text fg={muted()}>
								No shows. Subscribe from Discover/Search.
							</text>
						</box>
					}
				>
					<For each={shows()}>
						{(feed, index) => (
							<ShowRow
								feed={feed}
								title={showTitle(feed)}
								index={index}
								focused={focusedShowIdx}
								active={isActive}
								marker={marker}
								wlScope={() =>
									app.state().preferences.autoDownloadScope === "whitelist"
								}
								wlInList={() =>
									(app.state().preferences.autoDownloadWhitelist ?? []).includes(
										feed.id,
									)
								}
								onMouseDown={() => {
									nav.setActivePane(DEPTH_CENTER_PANE);
									nav.setDepthFocus(index(), 0);
								}}
							/>
						)}
					</For>
					<Show when={unsubs().length > 0}>
						<box paddingLeft={1} paddingTop={1}>
							<text fg={theme.textSecondary}>
								Unsubscribed Show Downloads
							</text>
						</box>
						<For each={unsubs()}>
							{(d, index) => (
								<UnsubscribedRow
									d={d}
									index={() => shows().length + index()}
									focused={focusedRow0}
									active={isActive}
									marker={marker}
									downloadLabel={() => downloadLabel(d.episodeId)}
									downloadColor={() => downloadColor(d.episodeId)}
									onMouseDown={() => {
										nav.setActivePane(DEPTH_CENTER_PANE);
										nav.setDepthFocus(shows().length + index(), 0);
									}}
								/>
							)}
						</For>
					</Show>
				<Show when={showLoadMore()}>
					<FetchMoreRow
						index={() => shows().length + unsubs().length}
						focused={focusedRow0}
						onMore={focusedOnMore0}
						active={isActive}
						isLoadingMore={() => feedStore.isLoadingMore()}
						nerd={nerd}
						marker={marker}
						onMouseDown={() => {
							nav.setActivePane(DEPTH_CENTER_PANE);
							nav.setDepthFocus(shows().length + unsubs().length, 0);
						}}
					/>
				</Show>
			</Show>
			</Show>
			{/* depth ≥1: episodes */}
			<Show when={depth() >= 1}>
				<Show
					when={episodes().length > 0}
					fallback={
						<box padding={1}>
							<text fg={muted()}>No episodes. :refresh</text>
						</box>
					}
				>
					{/* Spacers keep the scrollbox content at the FULL list
					    height so the scrollbar reflects the real list, not the
					    render window. */}
					<Show when={listWindow()[0] > 0}>
						<box height={listWindow()[0] * ROW_HEIGHT} />
					</Show>
					<For each={visibleEpisodes()}>
						{(ep, index) => (
							<EpisodeRow
								episode={ep}
								index={() => listWindow()[0] + index()}
								focused={focusedEpIdx}
								active={isActive}
								selected={() => nav.isSelected(ep.id)}
								downloadLabel={() => downloadLabel(ep.id)}
								downloadColor={() => downloadColor(ep.id)}
								marker={marker}
								onMouseDown={() => {
									nav.setActivePane(DEPTH_CENTER_PANE);
									nav.setDepthFocus(listWindow()[0] + index(), 1);
								}}
							/>
						)}
					</For>
					<Show when={episodes().length - listWindow()[1] > 0}>
						<box height={(episodes().length - listWindow()[1]) * ROW_HEIGHT} />
					</Show>
					<Show when={showFetchMore()}>
						<FetchMoreRow
							index={() => episodes().length}
							focused={focusedRow}
							onMore={focusedOnMore}
							active={isActive}
							isLoadingMore={() => feedStore.isLoadingMore()}
							nerd={nerd}
							marker={marker}
							onMouseDown={() => {
								nav.setActivePane(DEPTH_CENTER_PANE);
								nav.setDepthFocus(episodes().length, 1);
							}}
						/>
					</Show>
				</Show>
			</Show>
		</>
	);

	// ── preview pane ───────────────────────────────────────────────────────────
	const episodeHint = (epId: string) =>
		`enter: play · d: download${
			downloadStore.getDownloadStatus(epId) !== DownloadStatus.NONE
				? " · D: delete"
				: ""
		}${
			app.state().preferences.autoDownloadScope === "whitelist"
				? (app.state().preferences.autoDownloadWhitelist ?? []).includes(
						drilledShowId(),
					)
					? " · w: un-whitelist"
					: " · w: whitelist"
				: ""
		} · space: select · h: back`;

	const showHint = (show: Feed) =>
		`enter/l: open · h: back · x: unsubscribe${
			app.state().preferences.autoDownloadScope === "whitelist"
				? (app.state().preferences.autoDownloadWhitelist ?? []).includes(show.id)
					? " · w: un-whitelist"
					: " · w: whitelist"
				: ""
		}`;

	const previewContent = () =>
		depth() === 0 ? (
		// depth 0 preview: hovered "[Fetch More]" row, else the
		// unsubscribed-show download, else the hovered show.
		<>
			<Show when={focusedOnMore0()}>
				<FetchMorePreview
					isLoadingMore={() => feedStore.isLoadingMore()}
					manualText={() =>
						"Load the next batch of older episodes across all subscribed shows (Enter)."
					}
				/>
			</Show>
			<Show when={!focusedOnMore0()}>
				<Show
					when={focusedUnsub()}
					fallback={
						<Show
							when={selectedShow()}
							fallback={
								<box padding={1}>
									<text fg={muted()}>No show focused</text>
								</box>
							}
						>
							{(show) => (
								<ShowPreview
									show={() => show()}
									title={() => showTitle(show())}
									hint={() => showHint(show())}
								/>
							)}
						</Show>
					}
				>
					{(d) => (
						<UnsubscribedPreview
							d={() => d()}
							downloadLabel={() => downloadLabel(d().episodeId)}
							downloadColor={() => downloadColor(d().episodeId)}
						/>
					)}
				</Show>
			</Show>
		</>
	) : (
			// depth ≥1 preview: hovered episode (or the Fetch More row)
			<>
				<Show when={focusedOnMore()}>
					<FetchMorePreview
					isLoadingMore={() => feedStore.isLoadingMore()}
					manualText={() =>
							"Load the next batch of older episodes for this show (Enter)."
						}
					/>
				</Show>
				<Show when={!focusedOnMore()}>
					<Show
						when={focusedEpisode()}
						fallback={
							<box padding={1}>
								<text fg={muted()}>No episode focused</text>
							</box>
						}
					>
						{(ep) => (
							<EpisodePreview
								episode={() => ep()}
								author={() => selectedShow()?.podcast.author}
								downloadLabel={() => downloadLabel(ep().id)}
								downloadColor={() => downloadColor(ep().id)}
								hint={() => episodeHint(ep().id)}
							/>
						)}
					</Show>
				</Show>
			</>
		);

	return (
		<PaneRow
			parent={parentContent}
			current={currentContent}
			preview={previewContent}
			currentLabel={currentLabel}
			focused={isActive}
		/>
	);
}
