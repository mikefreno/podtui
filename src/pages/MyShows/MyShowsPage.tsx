/**
 * MyShowsPage — yazi-style 3-pane view (canonical reference migration).
 *
 *   pane 0 (parent)  — subscribed shows
 *   pane 1 (current) — episodes of the focused show
 *   pane 2 (preview) — detail of the focused episode
 *
 * Movement (j/k, gg/G, page-jumps) and selection (space, v) are driven by the
 * Shell router via the `nav.action` event bus; this page only subscribes and
 * translates actions against its own data. h/l swipe between panes is handled
 * by the Shell (nav.swipe). The focused row is read from nav.focusedIndex(pane)
 * so the page is purely reactive.
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
	PaneSlot,
	type PaneId,
} from "@/context/NavigationContext";
import { useAudio } from "@/hooks/useAudio";
import { on, off } from "@/utils/event-bus";
import type { KeybindActionName } from "@/context/KeybindContext";
import type { Episode } from "@/types/episode";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { PANE_RATIO } from "@/utils/navigation";

export const MyShowsPaneCount = 3;

export function MyShowsPage() {
	const feedStore = useFeedStore();
	const downloadStore = useDownloadStore();
	const audioNav = useAudioNavStore();
	const audio = useAudio();
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const nav = useNavigation();

	const SHOWS = PaneSlot.PARENT;
	const EPS = PaneSlot.CURRENT;
	const PREV = PaneSlot.PREVIEW;

	const shows = () => feedStore.getFilteredFeeds();

	// The selected show tracks the focused row of pane 0.
	const selectedShow = createMemo(() => {
		const list = shows();
		if (list.length === 0) return undefined;
		const idx = Math.min(nav.focusedIndex(SHOWS), list.length - 1);
		return list[idx];
	});

	const episodes = createMemo(() => {
		const show = selectedShow();
		if (!show) return [] as Episode[];
		return [...show.episodes].sort(
			(a, b) => b.pubDate.getTime() - a.pubDate.getTime(),
		);
	});

	// Register a resolver so visual-mode range selection grows by episode id.
	onMount(() => {
		nav.registerResolver(`${nav.activeTab()}:${EPS}`, (i) => episodes()[i]?.id);
		// keep the resolver fresh as the episode list changes
		const unsub = on("nav.action", () => {
			nav.registerResolver(
				`${nav.activeTab()}:${EPS}`,
				(i) => episodes()[i]?.id,
			);
		});
		onCleanup(() => unsub());
	});

	// Keep shows-focus in range after feeds load/change.
	const ensureShowsFocus = () => {
		const list = shows();
		if (list.length === 0) return;
		const cur = nav.focusedIndex(SHOWS);
		if (cur >= list.length) nav.setFocusedIndex(SHOWS, list.length - 1);
	};
	onMount(ensureShowsFocus);

	// When the show changes, reset episode focus + set audio-nav source + show count.
	const onShowChanged = () => {
		const show = selectedShow();
		if (!show) return;
		if (nav.focusedIndex(EPS) > episodes().length - 1)
			nav.setFocusedIndex(EPS, 0);
		audioNav.setSource(AudioSource.MY_SHOWS, show.podcast.id);
	};
	onMount(onShowChanged);

	const focusedEpisode = createMemo(() => {
		const eps = episodes();
		if (eps.length === 0) return undefined;
		const idx = Math.min(nav.focusedIndex(EPS), eps.length - 1);
		return eps[idx];
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

	// ── nav.action handler ──────────────────────────────────────────────────────
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
			if (p === SHOWS) {
				nav.swipe(1, MyShowsPaneCount);
				onShowChanged();
			} else if (p === EPS) {
				const ep = focusedEpisode();
				if (ep) playEpisode(ep);
			}
		},
		"toggle-select": (p) => {
			if (p === EPS) {
				const ep = focusedEpisode();
				if (ep) nav.toggleSelected(ep.id);
			}
		},
		refresh: () => {
			const show = selectedShow();
			if (show) feedStore.refreshFeed(show.id).catch(() => {});
		},
	};

	function len(pane: PaneId): number {
		if (pane === SHOWS) return shows().length;
		if (pane === EPS) return episodes().length;
		return 0;
	}
	function step(pane: PaneId, delta: number) {
		nav.move(delta, len(pane));
		if (pane === SHOWS) {
			// clamp episode focus + re-resolve after show change
			nav.setFocusedIndex(
				EPS,
				Math.min(nav.focusedIndex(EPS), Math.max(0, episodes().length - 1)),
			);
			onShowChanged();
		}
	}

	const onAction = (data: {
		action: KeybindActionName;
		pane: PaneId;
		mode: NavMode;
	}) => {
		// Only react when our tab is active.
		// (Shell always emits; router guarantees our tab is active.)
		ensureShowsFocus();
		const handler = PAGE_ACTIONS[data.action];
		if (handler) handler(data.pane);
		// visual selection growth is handled inside nav.move/registerResolver
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
			{/* ── pane 0: shows ─────────────────────────────────────────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.parent} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>Shows ({shows().length})</text>
				</box>
				<scrollbox
					height="100%"
					focused={isActive(SHOWS)}
					border
					borderColor={border(SHOWS)}
					backgroundColor={theme.background}
				>
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
							{(feed, index) => (
								<box
									flexDirection="row"
									gap={1}
									paddingLeft={1}
									paddingRight={1}
									backgroundColor={focusBg(index(), SHOWS)}
									onMouseDown={() => {
										nav.setActivePane(SHOWS);
										nav.setFocusedIndex(SHOWS, index());
										onShowChanged();
									}}
								>
									<text fg={focusFg(index(), SHOWS)}>
										{index() === nav.focusedIndex(SHOWS) ? "❯" : " "}
									</text>
									<text fg={focusFg(index(), SHOWS)}>
										{feed.customName || feed.podcast.title}
									</text>
									<text
										fg={
											index() === nav.focusedIndex(SHOWS)
												? theme.surface
												: muted()
										}
									>
										({feed.episodes.length})
									</text>
								</box>
							)}
						</For>
					</Show>
				</scrollbox>
			</box>

			{/* ── pane 1: episodes ──────────────────────────────────────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.current} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>
						{selectedShow()?.customName ||
							selectedShow()?.podcast.title ||
							"Episodes"}{" "}
						· {episodes().length}
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
							{(ep, index) => (
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
											{ep.episodeNumber ? `#${ep.episodeNumber} ` : ""}
											{ep.title}
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
											{formatDate(ep.pubDate)}
										</text>
										<text
											fg={
												index() === nav.focusedIndex(EPS)
													? theme.surface
													: muted()
											}
										>
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
							)}
						</For>
						<Show when={feedStore.isLoadingMore()}>
							<box paddingLeft={2} paddingTop={1}>
								<LoadingIndicator />
							</box>
						</Show>
					</Show>
				</scrollbox>
			</box>

			{/* ── pane 2: preview ───────────────────────────────────────────────────── */}
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
									{ep().description?.slice(0, 400) ??
										"No description available."}
									{(ep().description?.length ?? 0) > 400 ? "…" : ""}
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
