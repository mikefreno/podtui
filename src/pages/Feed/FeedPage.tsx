/**
 * FeedPage — flat chronological list of episodes across all subscribed feeds.
 *
 *   depth 0 (current) — every episode from every feed, newest-first (the
 *                       combined view the old "All Feeds" virtual row used to
 *                       drill into). Parent pane shows the muted tab list.
 *   preview            — detail of the hovered episode.
 *
 * This page does NOT drill: the previous depth-1 "episodes of one feed" panel
 * duplicated My Shows (shows → episodes). Per design, the Feed tab now just
 * shows the full flat episodes list immediately.
 *
 * Renders entirely through `<PaneRow>` (the shared parent|current|preview
 * primitive). `l`/Enter plays the focused episode; `h` pops back to the tab
 * root. j/k move only within the current column. The Shell router drives
 * everything over `nav.action`; this page only handles list/preview data.
 */

import { createMemo, createEffect, For, Show, onMount, onCleanup } from "solid-js";
import { useFeedStore } from "@/stores/feed";
import { useDownloadStore } from "@/stores/download";
import { useAppStore } from "@/stores/app";
import { prefetchCoverArt } from "@/utils/cover-art";
import { DownloadStatus } from "@/types/episode";
import { format } from "date-fns";
import { useTheme } from "@/context/ThemeContext";
import { useAudioNavStore, AudioSource } from "@/stores/audio-nav";
import {
	useNavigation,
	NavMode,
	DEPTH_CENTER_PANE,
	type PaneId,
} from "@/context/NavigationContext";
import { useAudio } from "@/hooks/useAudio";
import { on, off } from "@/utils/event-bus";
import { NF_ICONS, supportsNerdFonts } from "@/utils/nerd-fonts";
import type { KeybindActionName } from "@/context/KeybindContext";
import type { Episode } from "@/types/episode";
import type { Feed } from "@/types/feed";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { PaneRow } from "@/components/PaneRow";
import { TabListPane } from "@/components/TabPanel";
import { useScrollIntoView } from "@/hooks/useScrollIntoView";
import { useSelectionMarker } from "@/hooks/useSelectionMarker";

export const FeedPaneCount = 1;

type EpItem = { episode: Episode; feed: Feed };

function FeedPage() {
	// Static: detection never changes mid-session.
	const nerd = supportsNerdFonts();
	const feedStore = useFeedStore();
	const downloadStore = useDownloadStore();
	const audioNav = useAudioNavStore();
	const audio = useAudio();
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const nav = useNavigation();
	const marker = useSelectionMarker();

	// ── flat episode list (depth 0 — the only depth Feed has) ────────────────
	const episodes = createMemo<EpItem[]>(
		() => feedStore.getAllEpisodesChronological() as EpItem[],
	);

	// ── Cover warm-up ────────────────────────────────────────────────────────
	// Prefetch covers for episodes around the focus (plus the top of the
	// list) so plays land on a warm cache: cover-art-files only applies at
	// file load, and there is no working runtime fallback. Single-flight +
	// cache short-circuit keep repeat runs cheap (hits resolve immediately).
	createEffect(() => {
		const list = episodes();
		const focusIdx = focusedEpIdx();
		const start = Math.max(0, focusIdx - 10);
		const end = Math.min(list.length, focusIdx + 11);
		for (let i = start; i < end; i++) {
			const item = list[i];
			if (item?.feed.podcast.coverUrl) prefetchCoverArt(item.feed.podcast.coverUrl);
		}
	});

	// ── Fetch More ───────────────────────────────────────────────────────────
	// A "[Fetch More]" row at the bottom of the list advances every feed's
	// loaded window by 50 episodes. manual mode: Enter on the row. auto mode:
	// reaching the bottom row fetches automatically (see the effect below).
	const app = useAppStore();
	const fetchMoreMode = () => app.state().preferences.fetchMoreMode ?? "auto";
	const showFetchMore = () => feedStore.hasMoreAcrossAll();
	// Total navigable rows: episodes + the optional Fetch More row.
	const rowCount = () => episodes().length + (showFetchMore() ? 1 : 0);
	const focus = () => nav.depthFocus(0);
	const focusedRow = () =>
		rowCount() === 0 ? 0 : Math.min(focus(), rowCount() - 1);
	const focusedOnMore = () =>
		showFetchMore() && focusedRow() === episodes().length;
	// -1 while the Fetch More row is focused so no episode row renders the
	// cursor/highlight (the button is the focused row, not the last episode).
	const focusedEpIdx = () =>
		focusedOnMore()
			? -1
			: Math.min(focusedRow(), Math.max(episodes().length - 1, 0));
	const focusedItem = (): EpItem | undefined =>
		focusedOnMore() ? undefined : episodes()[focusedEpIdx()];
	const curLen = () => rowCount();
	const moreRef = useScrollIntoView(() => focusedOnMore());

	const ensureFocus = () => {
		if (rowCount() > 0 && focus() >= rowCount())
			nav.setDepthFocus(rowCount() - 1, 0);
	};
	onMount(ensureFocus);

	// Auto mode: reaching the bottom row loads the next batch. Guarded by
	// isLoadingMore so concurrent loads never stack.
	createEffect(() => {
		if (fetchMoreMode() !== "auto") return;
		if (!showFetchMore()) return;
		if (feedStore.isLoadingMore()) return;
		if (focusedRow() < rowCount() - 1) return;
		feedStore.loadMoreAllFeeds().catch(() => {});
	});

	onMount(() => {
		nav.registerResolver(
			`${nav.activeTab()}:${DEPTH_CENTER_PANE}`,
			(i) => episodes()[i]?.episode.id,
		);
	});

	// ── helpers ────────────────────────────────────────────────────────────────
	const formatDate = (d: Date) => format(d, "MMM d, yyyy");
	const formatDuration = (s: number) => {
		const mins = Math.floor(s / 60);
		const hrs = Math.floor(mins / 60);
		return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
	};
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
	const playEpisode = (item: EpItem | undefined) => {
		if (!item) return;
		audio.play(item.episode).catch(() => {});
		audioNav.setSource(AudioSource.FEED);
	};

	// ── open ───────────────────────────────────────────────────────────────────
	function open() {
		if (focusedOnMore()) {
			feedStore.loadMoreAllFeeds().catch(() => {});
			return;
		}
		playEpisode(focusedItem());
	}

	// ── nav.action handler ────────────────────────────────────────────────────
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
			const item = focusedItem();
			if (item) nav.toggleSelected(item.episode.id);
		},
		download: () => {
			const item = focusedItem();
			if (item) downloadStore.startDownload(item.episode, item.feed.id);
		},
		"delete-download": () => {
			const item = focusedItem();
			if (!item) return;
			const id = item.episode.id;
			if (downloadStore.getDownloadStatus(id) === DownloadStatus.NONE) return;
			downloadStore.cancelDownload(id);
			downloadStore.removeDownload(id).catch(() => {});
		},
		refresh: () => {
			feedStore.refreshAllFeeds().catch(() => {});
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
	// Row highlight within the list. `active=true` only for the current pane.
	const focusBg = (i: number, listFocus: number, active: boolean) =>
		i === listFocus && active
			? theme.primary
			: i === listFocus
				? theme.border
				: undefined;
	const focusFg = (i: number, listFocus: number, active: boolean) =>
		i === listFocus && active
			? theme.surface
			: i === listFocus
				? theme.selectedListItemText ?? theme.text
				: theme.text;

	const currentLabel = () => `Feed · ${episodes().length}`;

	// ── parent pane: muted tab list (no parent list — Feed is one depth) ──────
	const parentContent = () => <TabListPane muted />;

	// ── current pane: the flat episodes list (the only focusable column) ──────
	const currentContent = () => (
		<Show
			when={episodes().length > 0}
			fallback={
				<box padding={1} alignItems="center">
					<Show
						when={feedStore.isLoadingFeeds()}
						fallback={
							<text fg={muted()}>
								No feeds. Subscribe from Discover/Search.
							</text>
						}
					>
						<LoadingIndicator label="Refreshing…" />
					</Show>
				</box>
			}
		>
			<For each={episodes()}>
				{(item, index) => {
					const fi = () => focusedEpIdx();
					const ref = useScrollIntoView(() => index() === fi());
					return (
						<box
							ref={ref}
							flexDirection="column"
							gap={0}
							paddingRight={1}
							backgroundColor={focusBg(index(), fi(), isActive())}
							onMouseDown={() => {
								nav.setActivePane(DEPTH_CENTER_PANE);
								nav.setDepthFocus(index(), 0);
							}}
						>
							<box flexDirection="row" gap={1}>
								<text
									flexShrink={0}
									fg={focusFg(index(), fi(), isActive())}
								>
									{index() === fi() ? marker() : " "}
								</text>
								<text
									wrapMode="none"
									truncate
									fg={focusFg(index(), fi(), isActive())}
								>
									{item.episode.episodeNumber
										? `#${item.episode.episodeNumber} `
										: ""}
									{item.episode.title}
								</text>
							</box>
							{/* podcast name on its own row — readable at a glance; the
							    50% current pane fits it in full for typical names, and
							    truncate keeps the row one line tall either way */}
							<box paddingLeft={2}>
								<text
									wrapMode="none"
									truncate
									fg={index() === fi() ? theme.surface : theme.textSecondary}
								>
									{item.feed.customName || item.feed.podcast.title}
								</text>
							</box>
							<box flexDirection="row" gap={2} paddingLeft={2}>
								<text
									flexShrink={0}
									fg={index() === fi() ? theme.surface : theme.info}
								>
									{formatDate(item.episode.pubDate)}
								</text>
								<text
									flexShrink={0}
									fg={index() === fi() ? theme.surface : muted()}
								>
									{formatDuration(item.episode.duration)}
								</text>
								<Show when={nav.isSelected(item.episode.id)}>
									<text flexShrink={0} fg={theme.warning}>
										●
									</text>
								</Show>
								<Show when={downloadLabel(item.episode.id)}>
									<text flexShrink={0} fg={downloadColor(item.episode.id)}>
										{downloadLabel(item.episode.id)}
									</text>
								</Show>
							</box>
						</box>
					);
				}}
			</For>
			<Show when={showFetchMore()}>
				<box
					ref={moreRef}
					flexDirection="row"
					gap={1}
					paddingRight={1}
					backgroundColor={focusBg(episodes().length, focusedRow(), isActive())}
					onMouseDown={() => {
						nav.setActivePane(DEPTH_CENTER_PANE);
						nav.setDepthFocus(episodes().length, 0);
					}}
				>
					<text fg={focusFg(episodes().length, focusedRow(), isActive())}>
						{focusedOnMore() ? marker() : " "}
					</text>
					{nerd && (
						<text fg={focusFg(episodes().length, focusedRow(), isActive())}>
							{NF_ICONS.more}
						</text>
					)}
					<Show
						when={!feedStore.isLoadingMore()}
						fallback={<LoadingIndicator label="Fetching…" />}
					>
						<text fg={focusFg(episodes().length, focusedRow(), isActive())}>
							[Fetch More]
						</text>
					</Show>
				</box>
			</Show>
			<Show when={feedStore.isLoadingFeeds()}>
				<box alignItems="center" paddingTop={1}>
					<LoadingIndicator label="Refreshing…" />
				</box>
			</Show>
		</Show>
	);

	// ── preview pane: hovered-episode detail (or the Fetch More row) ──────────
	const previewContent = () => (
		<>
			<Show when={focusedOnMore()}>
				<box flexDirection="column" gap={1} padding={1}>
					<text fg={theme.textPrimary ?? theme.text}>
						<strong>[Fetch More]</strong>
					</text>
					<text fg={muted()}>
						{feedStore.isLoadingMore()
							? "Loading the next batch of episodes…"
							: fetchMoreMode() === "auto"
								? "Auto mode: the next batch loads automatically at the bottom of the list."
								: "Load the next batch of older episodes across all feeds (Enter)."}
					</text>
					<box height={1} />
					<text fg={muted()}>enter: load more · h back</text>
				</box>
			</Show>
			<Show when={!focusedOnMore()}>
				<Show
					when={focusedItem()}
					fallback={
						<box padding={1}>
							<text fg={muted()}>No episode focused</text>
						</box>
					}
				>
					{(item) => (
						<box flexDirection="column" gap={1} padding={1}>
							<text fg={theme.textPrimary ?? theme.text}>
								<strong>
									{item().episode.episodeNumber
										? `#${item().episode.episodeNumber} `
										: ""}
									{item().episode.title}
								</strong>
							</text>
							<box flexDirection="row" gap={2}>
								<text fg={theme.info}>{formatDate(item().episode.pubDate)}</text>
								<text fg={muted()}>{formatDuration(item().episode.duration)}</text>
								<Show when={downloadLabel(item().episode.id)}>
									<text fg={downloadColor(item().episode.id)}>
										{downloadLabel(item().episode.id)}
									</text>
								</Show>
							</box>
							<text fg={muted()}>
								{item().feed.customName || item().feed.podcast.title}
							</text>
							<Show when={item().feed.podcast.author}>
								<text fg={muted()}>by {item().feed.podcast.author}</text>
							</Show>
							<box height={1} />
							<text fg={theme.textSecondary}>
								{item().episode.description?.slice(0, 400) ??
									"No description available."}
								{(item().episode.description?.length ?? 0) > 400 ? "…" : ""}
							</text>
							<box height={1} />
							<text fg={muted()}>
								enter: play · d: download
								{downloadStore.getDownloadStatus(item().episode.id) !==
								DownloadStatus.NONE
									? " · D: delete"
									: ""}{" "}
								· space: select · h back
							</text>
						</box>
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

export { FeedPage };
