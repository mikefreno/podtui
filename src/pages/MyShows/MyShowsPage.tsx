/**
 * MyShowsPage — yazi depth-stack view of subscribed shows.
 *
 *   depth 0 (current) — subscribed shows. Parent pane shows the muted
 *                       placeholder (1/7 slot kept).
 *   depth 1 (current) — episodes of the drilled show. Parent pane = shows.
 *   preview            — detail of the hovered item in the current column.
 *
 * Renders entirely through `<PaneRow>`; no bespoke 3-column flexbox JSX
 * remains. `l`/Enter drills in (show → episodes); `h` pops a depth (noop at
 * 0). j/k move only within the current column.
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
import { PaneRow } from "@/components/PaneRow";
import { TabListPane } from "@/components/TabPanel";
import { useScrollIntoView } from "@/hooks/useScrollIntoView";

export const MyShowsPaneCount = 1;

export function MyShowsPage() {
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

	const shows = () => feedStore.getFilteredFeeds();

	const focusedShowIdx = () =>
		shows().length === 0 ? 0 : Math.min(focus(0), shows().length - 1);
	const selectedShow = (): Feed | undefined => shows()[focusedShowIdx()];

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
	const focusedEpIdx = () =>
		episodes().length === 0 ? 0 : Math.min(focus(1), episodes().length - 1);
	const focusedEpisode = () => episodes()[focusedEpIdx()];

	const curLen = () => (depth() === 0 ? shows().length : episodes().length);

	const ensureFocus = () => {
		if (shows().length > 0 && focus(0) >= shows().length)
			nav.setDepthFocus(shows().length - 1, 0);
		if (depth() >= 1 && episodes().length > 0 && focus(1) >= episodes().length)
			nav.setDepthFocus(episodes().length - 1, 1);
	};
	onMount(ensureFocus);

	onMount(() => {
		nav.registerResolver(`${nav.activeTab()}:${DEPTH_CENTER_PANE}`, (i) => {
			if (depth() === 0) return shows()[i]?.id;
			return episodes()[i]?.id;
		});
	});

	// ── helpers ─────────────────────────────────────────────────────────────────
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
	const playEpisode = (ep: Episode) => {
		audio.play(ep).catch(() => {});
		audioNav.setSource(AudioSource.MY_SHOWS, selectedShow()?.podcast.id);
	};

	// ── drill / open ───────────────────────────────────────────────────────────
	function open() {
		if (depth() === 0) {
			const show = selectedShow();
			if (!show) return;
			nav.pushDepth({ kind: "episodes", ctx: show.id, focus: 0 } as DepthFrame);
			nav.setActivePane(DEPTH_CENTER_PANE);
			audioNav.setSource(AudioSource.MY_SHOWS, show.podcast.id);
			return;
		}
		if (depth() >= 1) {
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
	const focusBg = (i: number, lf: number, active: boolean) =>
		i === lf && active ? theme.primary : i === lf ? theme.border : undefined;
	const focusFg = (i: number, lf: number, active: boolean) =>
		i === lf && active ? theme.surface : theme.text;
	const showTitle = (f: Feed) => f.customName || f.podcast.title;

	const currentLabel = () =>
		depth() === 0
			? `Shows (${shows().length})`
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
					return (
						<box
							ref={ref}
							flexDirection="row"
							gap={1}
							paddingLeft={1}
							paddingRight={1}
							backgroundColor={focusBg(index(), lf(), false)}
						>
							<text fg={focusFg(index(), lf(), false)}>
								{index() === lf() ? "❯" : " "}
							</text>
							<text fg={focusFg(index(), lf(), false)}>{showTitle(feed)}</text>
							<text fg={muted()}>({feed.episodes.length})</text>
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
					when={shows().length > 0}
					fallback={
						<box padding={1}>
							<text fg={muted()}>
								No shows. Subscribe from Discover/Search.
							</text>
						</box>
					}
				>
					<For each={shows()}>
						{(feed, index) => {
							const lf = () => focusedShowIdx();
							const ref = useScrollIntoView(() => index() === lf());
							return (
								<box
									ref={ref}
									flexDirection="row"
									gap={1}
									paddingLeft={1}
									paddingRight={1}
									backgroundColor={focusBg(index(), lf(), isActive())}
									onMouseDown={() => {
										nav.setActivePane(DEPTH_CENTER_PANE);
										nav.setDepthFocus(index(), 0);
									}}
								>
									<text fg={focusFg(index(), lf(), isActive())}>
										{index() === lf() ? "❯" : " "}
									</text>
									<text fg={focusFg(index(), lf(), isActive())}>
										{showTitle(feed)}
									</text>
									<text fg={index() === lf() ? theme.surface : muted()}>
										({feed.episodes.length})
									</text>
								</box>
							);
						}}
					</For>
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
					<For each={episodes()}>
						{(ep, index) => {
							const lf = () => focusedEpIdx();
							const ref = useScrollIntoView(() => index() === lf());
							return (
								<box
									ref={ref}
									flexDirection="column"
									gap={0}
									paddingLeft={1}
									paddingRight={1}
									backgroundColor={focusBg(index(), lf(), isActive())}
									onMouseDown={() => {
										nav.setActivePane(DEPTH_CENTER_PANE);
										nav.setDepthFocus(index(), 1);
									}}
								>
									<box flexDirection="row" gap={1}>
										<text fg={focusFg(index(), lf(), isActive())}>
											{index() === lf() ? "❯" : " "}
										</text>
										<text fg={focusFg(index(), lf(), isActive())}>
											{ep.episodeNumber ? `#${ep.episodeNumber} ` : ""}
											{ep.title}
										</text>
									</box>
									<box flexDirection="row" gap={2} paddingLeft={2}>
										<text fg={index() === lf() ? theme.surface : theme.info}>
											{formatDate(ep.pubDate)}
										</text>
										<text fg={index() === lf() ? theme.surface : muted()}>
											{formatDuration(ep.duration)}
										</text>
										<Show when={nav.isSelected(ep.id)}>
											<text fg={theme.warning}>●</text>
										</Show>
										<Show when={downloadLabel(ep.id)}>
											<text fg={downloadColor(ep.id)}>
												{downloadLabel(ep.id)}
											</text>
										</Show>
									</box>
								</box>
							);
						}}
					</For>
					<Show when={feedStore.isLoadingMore()}>
						<box paddingLeft={2} paddingTop={1}>
							<LoadingIndicator />
						</box>
					</Show>
				</Show>
			</Show>
		</>
	);

	// ── preview pane ───────────────────────────────────────────────────────────
	const previewContent = () =>
		depth() === 0 ? (
			// depth 0 preview: hovered show
			<Show
				when={selectedShow()}
				fallback={
					<box padding={1}>
						<text fg={muted()}>No show focused</text>
					</box>
				}
			>
				{(show) => (
					<box flexDirection="column" gap={1} padding={1}>
						<text fg={theme.textPrimary ?? theme.text}>
							<strong>{showTitle(show())}</strong>
						</text>
						<Show when={show().podcast.author}>
							<text fg={muted()}>by {show().podcast.author}</text>
						</Show>
						<text fg={theme.textSecondary}>
							{show().episodes.length} episodes
						</text>
						<text fg={muted()}>
							{show().podcast.description?.slice(0, 400) ?? "No description."}
						</text>
						<box height={1} />
						<text fg={muted()}>enter/l: open · h: back · x: unsubscribe</text>
					</box>
				)}
			</Show>
		) : (
			// depth ≥1 preview: hovered episode
			<Show
				when={focusedEpisode()}
				fallback={
					<box padding={1}>
						<text fg={muted()}>No episode focused</text>
					</box>
				}
			>
				{(ep) => (
					<box flexDirection="column" gap={1} padding={1}>
						<text fg={theme.textPrimary ?? theme.text}>
							<strong>
								{ep().episodeNumber ? `#${ep().episodeNumber} ` : ""}
								{ep().title}
							</strong>
						</text>
						<box flexDirection="row" gap={2}>
							<text fg={theme.info}>{formatDate(ep().pubDate)}</text>
							<text fg={muted()}>{formatDuration(ep().duration)}</text>
							<Show when={downloadLabel(ep().id)}>
								<text fg={downloadColor(ep().id)}>
									{downloadLabel(ep().id)}
								</text>
							</Show>
						</box>
						<Show when={selectedShow()?.podcast.author}>
							<text fg={muted()}>by {selectedShow()!.podcast.author}</text>
						</Show>
						<box height={1} />
						<text fg={theme.textSecondary}>
							{ep().description?.slice(0, 400) ?? "No description available."}
							{(ep().description?.length ?? 0) > 400 ? "…" : ""}
						</text>
						<box height={1} />
						<text fg={muted()}>enter: play · space: select · h: back</text>
					</box>
				)}
			</Show>
		);

	return (
		<PaneRow
			parent={parentContent}
			current={currentContent}
			preview={previewContent}
			parentLabel={() => (depth() >= 1 ? "Shows" : "Up")}
			currentLabel={currentLabel}
			previewLabel="Detail"
			focused={isActive}
		/>
	);
}
