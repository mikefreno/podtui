/**
 * FeedPage — yazi depth-stack view of episodes across subscribed shows.
 *
 *   depth 0 (current) — subscribed feeds list (containers); index 0 is a
 *                       virtual "All Feeds". Parent pane shows the muted
 *                       placeholder (1/7 slot kept).
 *   depth 1 (current) — flat episodes list for the drilled feed (reverse
 *                       chronological). Parent pane = the feeds list (prev).
 *   preview            — detail of the hovered item in the current column.
 *
 * Renders entirely through `<YaziPaneRow>` (the shared parent|current|preview
 * primitive); no bespoke 3-column flexbox JSX remains. `l`/Enter drills in
 * (push); `h` pops a depth (noop at 0). j/k move only within the current
 * column. The Shell router drives everything over `nav.action`; this page
 * only handles list/preview data.
 */

import { createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { useFeedStore } from "@/stores/feed";
import { useDownloadStore } from "@/stores/download";
import { DownloadStatus } from "@/types/episode";
import { format } from "date-fns";
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
import type { KeybindActionName } from "@/context/KeybindContext";
import type { Episode } from "@/types/episode";
import type { Feed } from "@/types/feed";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { YaziPaneRow } from "@/components/YaziPaneRow";
import { TabListPane } from "@/components/TabPanel";

export const FeedPaneCount = 1;

type FeedListItem = { kind: "all" } | { kind: "feed"; feed: Feed };
type EpItem = { episode: Episode; feed: Feed };

function FeedPage() {
	const feedStore = useFeedStore();
	const downloadStore = useDownloadStore();
	const audioNav = useAudioNavStore();
	const audio = useAudio();
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const nav = useNavigation();

	const stack = nav.depthStack;
	const depth = nav.currentDepth;
	const focus = (d: number = depth()) => nav.depthFocus(d);

	// ── feeds list (depth 0) ─────────────────────────────────────────────────
	const feedList = createMemo<FeedListItem[]>(() => {
		const all: FeedListItem[] = [{ kind: "all" }];
		for (const f of feedStore.getFilteredFeeds())
			all.push({ kind: "feed", feed: f });
		return all;
	});
	const focusedFeedIdx = () =>
		feedList().length === 0 ? 0 : Math.min(focus(0), feedList().length - 1);
	const focusedFeedItem = (): FeedListItem | undefined =>
		feedList()[focusedFeedIdx()];

	// ── episodes list (depth 1) — derived from the depth-1 frame's ctx ───────
	const drilledFeedId = (): string => stack()[1]?.ctx ?? "all";
	const episodes = createMemo<EpItem[]>(() => {
		if (depth() < 1) return [];
		const id = drilledFeedId();
		if (id === "all")
			return feedStore.getAllEpisodesChronological() as EpItem[];
		const f = feedStore.getFilteredFeeds().find((x) => x.podcast.id === id);
		if (!f) return [];
		return [...f.episodes]
			.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
			.map((episode) => ({ episode, feed: f }));
	});
	const focusedEpIdx = () =>
		episodes().length === 0 ? 0 : Math.min(focus(1), episodes().length - 1);
	const focusedItem = (): EpItem | undefined => episodes()[focusedEpIdx()];

	const curLen = () => (depth() === 0 ? feedList().length : episodes().length);

	const ensureFocus = () => {
		if (depth() === 0 && feedList().length > 0 && focus(0) >= feedList().length)
			nav.setDepthFocus(feedList().length - 1, 0);
		if (depth() >= 1 && episodes().length > 0 && focus(1) >= episodes().length)
			nav.setDepthFocus(episodes().length - 1, 1);
	};
	onMount(ensureFocus);

	onMount(() => {
		nav.registerResolver(`${nav.activeTab()}:${DEPTH_CENTER_PANE}`, (i) => {
			if (depth() === 0) {
				const it = feedList()[i];
				return it?.kind === "feed" ? it.feed.podcast.id : "all";
			}
			return episodes()[i]?.episode.id;
		});
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

	// ── drill / open ───────────────────────────────────────────────────────────
	function open() {
		if (depth() === 0) {
			const item = focusedFeedItem();
			if (!item) return;
			const ctx = item.kind === "all" ? "all" : item.feed.podcast.id;
			nav.pushDepth({ kind: "episodes", ctx, focus: 0 } as DepthFrame);
			nav.setActivePane(DEPTH_CENTER_PANE);
			return;
		}
		if (depth() >= 1) {
			playEpisode(focusedItem());
		}
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
			if (depth() >= 1) {
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
	// Row highlight within a list. `active=true` only for the current pane.
	const focusBg = (i: number, listFocus: number, active: boolean) =>
		i === listFocus && active
			? theme.primary
			: i === listFocus
				? theme.border
				: undefined;
	const focusFg = (i: number, listFocus: number, active: boolean) =>
		i === listFocus && active ? theme.surface : theme.text;

	const feedLabel = (item: FeedListItem) =>
		item.kind === "all"
			? "All Feeds"
			: item.feed.customName || item.feed.podcast.title;
	const feedCount = (item: FeedListItem) =>
		item.kind === "all"
			? feedStore.getAllEpisodesChronological().length
			: item.feed.episodes.length;

	const currentLabel = () =>
		depth() === 0
			? `Feeds · ${feedList().length - 1}`
			: `${(() => {
					const fi = focusedFeedItem();
					return fi?.kind === "feed"
						? fi.feed.customName || fi.feed.podcast.title
						: "All Episodes";
				})()} · ${episodes().length}`;

	// ── parent pane: previous-depth list (muted/blank at depth 0) ──────────
	// Wrap in a stable <Show> (the sibling-Show pattern) so the parent list
	// mounts/unmounts cleanly on depth change instead of swapping roots.
	const parentContent = () => (
		<Show when={depth() >= 1} fallback={<TabListPane muted />}>
			<For each={feedList()}>
				{(item, index) => {
					const lf = nav.depthFocus(0);
					return (
						<box
							flexDirection="row"
							gap={1}
							paddingLeft={1}
							paddingRight={1}
							backgroundColor={focusBg(index(), lf, false)}
						>
							<text fg={focusFg(index(), lf, false)}>
								{index() === lf ? "❯" : " "}
							</text>
							<text fg={focusFg(index(), lf, false)}>{feedLabel(item)}</text>
							<text fg={muted()}>({feedCount(item)})</text>
						</box>
					);
				}}
			</For>
		</Show>
	);

	// ── current pane: the current-depth list (the only focusable column) ──────
	const currentContent = () => (
		<>
			{/* depth 0: feeds — stable sibling <Show> so the swap disposes cleanly */}
			<Show when={depth() === 0}>
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
							const fi = focusedFeedIdx();
							return (
								<box
									flexDirection="row"
									gap={1}
									paddingLeft={1}
									paddingRight={1}
									backgroundColor={focusBg(index(), fi, isActive())}
									onMouseDown={() => {
										nav.setActivePane(DEPTH_CENTER_PANE);
										nav.setDepthFocus(index(), 0);
									}}
								>
									<text fg={focusFg(index(), fi, isActive())}>
										{index() === fi ? "❯" : " "}
									</text>
									<text fg={focusFg(index(), fi, isActive())}>
										{feedLabel(item)}
									</text>
									<text fg={index() === fi ? theme.surface : muted()}>
										({feedCount(item)})
									</text>
								</box>
							);
						}}
					</For>
				</Show>
			</Show>
			<Show when={depth() >= 1}>
				{/* depth ≥1: episodes */}
				<Show
					when={episodes().length > 0}
					fallback={
						<box padding={1}>
							<text fg={muted()}>No episodes. :refresh</text>
						</box>
					}
				>
					<For each={episodes()}>
						{(item, index) => {
							const fi = focusedEpIdx();
							return (
								<box
									flexDirection="column"
									gap={0}
									paddingLeft={1}
									paddingRight={1}
									backgroundColor={focusBg(index(), fi, isActive())}
									onMouseDown={() => {
										nav.setActivePane(DEPTH_CENTER_PANE);
										nav.setDepthFocus(index(), 1);
									}}
								>
									<box flexDirection="row" gap={1}>
										<text fg={focusFg(index(), fi, isActive())}>
											{index() === fi ? "❯" : " "}
										</text>
										<text fg={focusFg(index(), fi, isActive())}>
											{item.episode.episodeNumber
												? `#${item.episode.episodeNumber} `
												: ""}
											{item.episode.title}
										</text>
									</box>
									<box flexDirection="row" gap={2} paddingLeft={2}>
										<text fg={index() === fi ? theme.surface : theme.info}>
											{formatDate(item.episode.pubDate)}
										</text>
										<text fg={index() === fi ? theme.surface : muted()}>
											{formatDuration(item.episode.duration)}
										</text>
										<text fg={index() === fi ? theme.surface : muted()}>
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
							);
						}}
					</For>
					<Show when={feedStore.isLoadingFeeds()}>
						<box paddingLeft={2} paddingTop={1}>
							<LoadingIndicator />
						</box>
					</Show>
				</Show>
			</Show>
		</>
	);

	// ── preview pane: hovered-item detail ──────────────────────────────────────
	const previewContent = () =>
		depth() === 0 ? (
			// depth 0 preview: hovered feed
			<Show
				when={focusedFeedItem()}
				fallback={
					<box padding={1}>
						<text fg={muted()}>No feed focused</text>
					</box>
				}
			>
				{(item) => {
					const it = item();
					return (
						<box flexDirection="column" gap={1} padding={1}>
							<text fg={theme.textPrimary ?? theme.text}>
								<strong>{feedLabel(it)}</strong>
							</text>
							<text fg={muted()}>
								{it.kind === "feed"
									? `by ${it.feed.podcast.author ?? "unknown"}`
									: ""}
							</text>
							<text fg={theme.textSecondary}>
								{it.kind === "all"
									? `${feedCount(it)} episodes across all feeds`
									: `${feedCount(it)} episodes`}
							</text>
							<text fg={muted()}>
								{it.kind === "feed"
									? (it.feed.podcast.description?.slice(0, 400) ??
										"No description.")
									: "Drill in to see episodes across every feed."}
							</text>
							<box height={1} />
							<text fg={muted()}>enter/l: open · h: back</text>
						</box>
					);
				}}
			</Show>
		) : (
			// depth ≥1 preview: hovered episode
			<Show
				when={focusedItem()}
				fallback={
					<box padding={1}>
						<text fg={muted()}>No episode focused</text>
					</box>
				}
			>
				{(item) => {
					const it = item();
					return (
						<box flexDirection="column" gap={1} padding={1}>
							<text fg={theme.textPrimary ?? theme.text}>
								<strong>
									{it.episode.episodeNumber
										? `#${it.episode.episodeNumber} `
										: ""}
									{it.episode.title}
								</strong>
							</text>
							<box flexDirection="row" gap={2}>
								<text fg={theme.info}>{formatDate(it.episode.pubDate)}</text>
								<text fg={muted()}>{formatDuration(it.episode.duration)}</text>
								<Show when={downloadLabel(it.episode.id)}>
									<text fg={downloadColor(it.episode.id)}>
										{downloadLabel(it.episode.id)}
									</text>
								</Show>
							</box>
							<text fg={muted()}>
								{it.feed.customName || it.feed.podcast.title}
							</text>
							<Show when={it.feed.podcast.author}>
								<text fg={muted()}>by {it.feed.podcast.author}</text>
							</Show>
							<box height={1} />
							<text fg={theme.textSecondary}>
								{it.episode.description?.slice(0, 400) ??
									"No description available."}
								{(it.episode.description?.length ?? 0) > 400 ? "…" : ""}
							</text>
							<box height={1} />
							<text fg={muted()}>enter: play · space: select · h: back</text>
						</box>
					);
				}}
			</Show>
		);

	return (
		<YaziPaneRow
			parent={parentContent}
			current={currentContent}
			preview={previewContent}
			parentLabel={() => (depth() >= 1 ? "Feeds" : "Up")}
			currentLabel={currentLabel}
			previewLabel="Detail"
			focused={isActive}
		/>
	);
}

export { FeedPage };
