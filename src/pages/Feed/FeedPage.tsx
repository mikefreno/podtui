/**
 * FeedPage — yazi-style 3-pane view of all episodes across subscribed shows.
 *
 *   pane 0 (parent)  — subscribed feeds list (the "containers"); an implicit
 *                      "All Feeds" entry at index 0 shows every episode.
 *   pane 1 (current) — flat episodes list for the focused feed (reverse
 *                      chronological). This is the landing pane.
 *   pane 2 (preview) — detail of the focused episode.
 *
 * The Shell resets activePane to CURRENT(1) on tab enter. h/l swipe between
 * panes; j/k move within; Enter plays; Space selects. Yazi [1,4,3] grow ratio.
 */

import {
	createMemo,
	For,
	Show,
	onMount,
	onCleanup,
	createEffect,
} from "solid-js";
import { useFeedStore } from "@/stores/feed";
import { useDownloadStore } from "@/stores/download";
import { DownloadStatus } from "@/types/episode";
import { format } from "date-fns";
import { useTheme } from "@/context/ThemeContext";
import { useAudioNavStore, AudioSource } from "@/stores/audio-nav";
import {
	useNavigation,
	NavMode,
	PaneSlot,
	type PaneId,
} from "@/context/NavigationContext";
import { useAudio } from "@/hooks/useAudio";
import { on, off } from "@/utils/event-bus";
import type { KeybindActionName } from "@/context/KeybindContext";
import type { Episode } from "@/types/episode";
import type { Feed } from "@/types/feed";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { PANE_RATIO } from "@/utils/navigation";

export const FeedPaneCount = 3;

type FeedListItem = { kind: "all" } | { kind: "feed"; feed: Feed };

function FeedPage() {
	const feedStore = useFeedStore();
	const downloadStore = useDownloadStore();
	const audioNav = useAudioNavStore();
	const audio = useAudio();
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const nav = useNavigation();

	const FEEDS = PaneSlot.PARENT; // 0 — subscribed feeds (parent)
	const EPS = PaneSlot.CURRENT; // 1 — episodes list (landing pane)
	const PREV = PaneSlot.PREVIEW; // 2 — episode detail

	// ── feeds pane data ──────────────────────────────────────────────────────
	// Index 0 = virtual "All Feeds"; 1..N = subscribed feeds (sorted, pinned first).
	const feedList = createMemo<FeedListItem[]>(() => {
		const all: FeedListItem[] = [{ kind: "all" }];
		for (const f of feedStore.getFilteredFeeds())
			all.push({ kind: "feed", feed: f });
		return all;
	});
	const focusedFeedItem = createMemo(() => {
		const list = feedList();
		if (list.length === 0) return undefined;
		return list[Math.min(nav.focusedIndex(FEEDS), list.length - 1)];
	});

	// ── episodes pane data (filtered by focused feed, or all) ────────────────
	type EpItem = { episode: Episode; feed: Feed };
	const episodes = createMemo<EpItem[]>(() => {
		const item = focusedFeedItem();
		if (!item || item.kind === "all")
			return feedStore.getAllEpisodesChronological() as EpItem[];
		return [...item.feed.episodes]
			.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
			.map((episode) => ({ episode, feed: item.feed }));
	});

	// Reset episodes focus when the feed filter changes.
	createEffect(() => {
		focusedFeedItem();
		nav.setFocusedIndex(EPS, 0);
	});

	const focusedItem = createMemo<EpItem | undefined>(() => {
		const list = episodes();
		if (list.length === 0) return undefined;
		return list[Math.min(nav.focusedIndex(EPS), list.length - 1)];
	});

	// Keep resolvers fresh so visual-mode range selection grows by id.
	onMount(() => {
		nav.registerResolver(
			`${nav.activeTab()}:${EPS}`,
			(i) => episodes()[i]?.episode.id,
		);
		const unsub = on("nav.action", () => {
			nav.registerResolver(
				`${nav.activeTab()}:${EPS}`,
				(i) => episodes()[i]?.episode.id,
			);
		});
		onCleanup(() => unsub());
	});

	const ensureFocus = () => {
		const eps = episodes();
		if (eps.length > 0 && nav.focusedIndex(EPS) >= eps.length)
			nav.setFocusedIndex(EPS, eps.length - 1);
		const fl = feedList();
		if (fl.length > 0 && nav.focusedIndex(FEEDS) >= fl.length)
			nav.setFocusedIndex(FEEDS, fl.length - 1);
	};
	onMount(ensureFocus);

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

	// ── nav.action handler ────────────────────────────────────────────────────
	const PAGE_ACTIONS: Partial<
		Record<KeybindActionName, (pane: PaneId) => void>
	> = {
		"move-down": (p) => step(p, 1),
		"move-up": (p) => step(p, -1),
		"jump-down": (p) => step(p, 5),
		"jump-up": (p) => step(p, -5),
		"page-down": (p) => step(p, 10),
		"page-up": (p) => step(p, -10),
		"goto-top": (p) => nav.gotoIndex(0, len(p)),
		"goto-bottom": (p) => nav.gotoIndex(len(p) - 1, len(p)),
		open: (p) => {
			if (p === FEEDS) nav.swipe(1, FeedPaneCount); // dive into episodes
			if (p === EPS) playEpisode(focusedItem());
		},
		"toggle-select": (p) => {
			if (p === EPS) {
				const item = focusedItem();
				if (item) nav.toggleSelected(item.episode.id);
			}
		},
		refresh: () => {
			const item = focusedFeedItem();
			if (item?.kind === "feed")
				feedStore.refreshFeed(item.feed.id).catch(() => {});
			else feedStore.refreshAllFeeds().catch(() => {});
		},
	};

	function len(pane: PaneId): number {
		if (pane === FEEDS) return feedList().length;
		if (pane === EPS) return episodes().length;
		return 0;
	}
	function step(pane: PaneId, delta: number) {
		nav.move(delta, len(pane));
	}

	const onAction = (data: {
		action: KeybindActionName;
		pane: PaneId;
		mode: NavMode;
	}) => {
		ensureFocus();
		const handler = PAGE_ACTIONS[data.action];
		if (handler) handler(data.pane);
	};
	onMount(() => {
		on("nav.action", onAction);
		onCleanup(() => off("nav.action", onAction));
	});

	// ── render ──────────────────────────────────────────────────────────────────
	const isActive = (p: PaneId) => nav.activePane() === p;
	const border = (p: PaneId) => (isActive(p) ? theme.accent : theme.border);
	const focusBg = (i: number, pane: PaneId) =>
		i === nav.focusedIndex(pane) && isActive(pane)
			? theme.primary
			: i === nav.focusedIndex(pane)
				? theme.border
				: undefined;
	const focusFg = (i: number, pane: PaneId) =>
		i === nav.focusedIndex(pane) && isActive(pane) ? theme.surface : theme.text;

	return (
		<box flexDirection="row" flexGrow={1} width="100%" height="100%">
			{/* ── pane 0 (parent, left): feeds ───────────────────────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.parent} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>Feeds · {feedList().length - 1}</text>
				</box>
				<scrollbox
					height="100%"
					focused={isActive(FEEDS)}
					border
					borderColor={border(FEEDS)}
					backgroundColor={theme.background}
				>
					<Show
						when={feedList().length > 1}
						fallback={
							<box padding={1}>
								<text fg={muted()}>
									No feeds. Subscribe from Discover/Search.
								</text>
							</box>
						}
					>
						<For each={feedList()}>
							{(item, index) => {
								const label = () =>
									item.kind === "all"
										? "All Feeds"
										: item.feed.customName || item.feed.podcast.title;
								const count = () =>
									item.kind === "all"
										? feedStore.getAllEpisodesChronological().length
										: item.feed.episodes.length;
								return (
									<box
										flexDirection="row"
										gap={1}
										paddingLeft={1}
										paddingRight={1}
										backgroundColor={focusBg(index(), FEEDS)}
										onMouseDown={() => {
											nav.setActivePane(FEEDS);
											nav.setFocusedIndex(FEEDS, index());
										}}
									>
										<text fg={focusFg(index(), FEEDS)}>
											{index() === nav.focusedIndex(FEEDS) ? "❯" : " "}
										</text>
										<text fg={focusFg(index(), FEEDS)}>{label()}</text>
										<text
											fg={
												index() === nav.focusedIndex(FEEDS)
													? theme.surface
													: muted()
											}
										>
											({count()})
										</text>
									</box>
								);
							}}
						</For>
					</Show>
				</scrollbox>
			</box>

			{/* ── pane 1 (current, center): episodes ─────────────────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.current} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>
						{(() => {
							const fi = focusedFeedItem();
							if (fi?.kind === "feed")
								return fi.feed.customName || fi.feed.podcast.title;
							return "All Episodes";
						})()} · {episodes().length}
					</text>
				</box>
				<scrollbox
					height="100%"
					focused={isActive(EPS)}
					border
					borderColor={border(EPS)}
					backgroundColor={theme.background}
				>
					<Show
						when={episodes().length > 0}
						fallback={
							<box padding={1}>
								<text fg={muted()}>No episodes. :refresh</text>
							</box>
						}
					>
						<For each={episodes()}>
							{(item, index) => (
								<box
									flexDirection="column"
									gap={0}
									paddingLeft={1}
									paddingRight={1}
									backgroundColor={focusBg(index(), EPS)}
									onMouseDown={() => {
										nav.setActivePane(EPS);
										nav.setFocusedIndex(EPS, index());
									}}
								>
									<box flexDirection="row" gap={1}>
										<text fg={focusFg(index(), EPS)}>
											{index() === nav.focusedIndex(EPS) ? "❯" : " "}
										</text>
										<text fg={focusFg(index(), EPS)}>
											{item.episode.episodeNumber
												? `#${item.episode.episodeNumber} `
												: ""}
											{item.episode.title}
										</text>
									</box>
									<box flexDirection="row" gap={2} paddingLeft={2}>
										<text
											fg={
												index() === nav.focusedIndex(EPS)
													? theme.surface
													: theme.info
											}
										>
											{formatDate(item.episode.pubDate)}
										</text>
										<text
											fg={
												index() === nav.focusedIndex(EPS)
													? theme.surface
													: muted()
											}
										>
											{formatDuration(item.episode.duration)}
										</text>
										<text
											fg={
												index() === nav.focusedIndex(EPS)
													? theme.surface
													: muted()
											}
										>
											{item.feed.customName || item.feed.podcast.title}
										</text>
										<Show when={nav.isSelected(item.episode.id)}>
											<text fg={theme.warning}>●</text>
										</Show>
										<Show when={downloadLabel(item.episode.id)}>
											<text fg={downloadColor(item.episode.id)}>
												{downloadLabel(item.episode.id)}
											</text>
										</Show>
									</box>
								</box>
							)}
						</For>
						<Show when={feedStore.isLoadingFeeds()}>
							<box paddingLeft={2} paddingTop={1}>
								<LoadingIndicator />
							</box>
						</Show>
					</Show>
				</scrollbox>
			</box>

			{/* ── pane 2 (preview, right): episode detail ───────────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.preview} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>Preview</text>
				</box>
				<scrollbox
					height="100%"
					focused={isActive(PREV)}
					border
					borderColor={border(PREV)}
					backgroundColor={theme.background}
				>
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
									<text fg={theme.info}>
										{formatDate(item().episode.pubDate)}
									</text>
									<text fg={muted()}>
										{formatDuration(item().episode.duration)}
									</text>
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
								<text fg={muted()}>enter: play space: select h/l: panes</text>
							</box>
						)}
					</Show>
				</scrollbox>
			</box>
		</box>
	);
}

export { FeedPage };
