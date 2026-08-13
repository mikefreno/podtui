/**
 * DiscoverPage — yazi depth-stack view of discoverable podcasts.
 *
 *   depth 0 (current) — category list. Parent pane shows the muted
 *                       placeholder (1/5 slot kept).
 *   depth 1 (current) — podcast results for the drilled category. Parent
 *                       pane = the categories list.
 *   depth 2 (current) — episodes of the drilled show, fetched on demand
 *                       WITHOUT subscribing. Parent pane = the results list.
 *   preview            — detail of the hovered item (category summary,
 *                       podcast detail, or episode detail).
 *
 * Renders entirely through `<PaneRow>`; no bespoke 3-column flexbox JSX
 * remains. `l`/Enter drills in (category → results → episodes); `a`
 * subscribes the focused show (enter/l never subscribe — they open the
 * episode list); `h` pops a depth (noop at 0). j/k move only within the
 * current column. Moving through categories at depth 0 updates the store's
 * selected category so the preview follows.
 */

import { createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { useDiscoverStore, DISCOVER_CATEGORIES } from "@/stores/discover";
import { useFeedStore } from "@/stores/feed";
import { useDownloadStore } from "@/stores/download";
import { useAudio } from "@/hooks/useAudio";
import { useAudioNavStore, AudioSource } from "@/stores/audio-nav";
import { DownloadStatus } from "@/types/episode";
import type { Episode } from "@/types/episode";
import type { Podcast } from "@/types/podcast";
import { format } from "date-fns";
import { useTheme } from "@/context/ThemeContext";
import {
	useNavigation,
	NavMode,
	DEPTH_CENTER_PANE,
	type PaneId,
	type DepthFrame,
} from "@/context/NavigationContext";
import { on, off } from "@/utils/event-bus";
import { supportsNerdFonts } from "@/utils/nerd-fonts";
import type { KeybindActionName } from "@/context/KeybindContext";
import { PaneRow } from "@/components/PaneRow";
import { TabListPane } from "@/components/TabPanel";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { EpisodeRow, EpisodePreview } from "@/components/EpisodeList";
import { useScrollIntoView } from "@/hooks/useScrollIntoView";
import { useSelectionMarker } from "@/hooks/useSelectionMarker";

export const DiscoverPaneCount = 1;

function DiscoverPage() {
	// Static: detection never changes mid-session.
	const nerd = supportsNerdFonts();
	const discoverStore = useDiscoverStore();
	const feedStore = useFeedStore();
	const downloadStore = useDownloadStore();
	const audio = useAudio();
	const audioNav = useAudioNavStore();
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const nav = useNavigation();
	const marker = useSelectionMarker();

	const stack = nav.depthStack;
	const depth = nav.currentDepth;
	const focus = (d: number = depth()) => nav.depthFocus(d);

	const categories = () => DISCOVER_CATEGORIES;
	const podcasts = () => discoverStore.filteredPodcasts();

	const focusedCatIdx = () =>
		categories().length === 0 ? 0 : Math.min(focus(0), categories().length - 1);
	const focusedCategory = createMemo(() => categories()[focusedCatIdx()]);

	const focusedPodIdx = () =>
		podcasts().length === 0 ? 0 : Math.min(focus(1), podcasts().length - 1);
	const focusedPodcast = createMemo(() => podcasts()[focusedPodIdx()]);

	// depth-2 frame ctx = the drilled podcast id (episode preview, no
	// subscription). Episodes come from the discover store's session cache.
	const drilledPodcastId = (): string => stack()[2]?.ctx ?? "";
	const drilledPodcast = (): Podcast | undefined =>
		podcasts().find((p) => p.id === drilledPodcastId());
	const episodes = createMemo<Episode[]>(() => {
		if (depth() < 2) return [];
		return discoverStore.episodesForPodcast(drilledPodcastId());
	});
	const episodesLoading = () =>
		depth() >= 2 && discoverStore.isLoadingEpisodesFor(drilledPodcastId());
	const episodesError = () =>
		depth() >= 2 ? discoverStore.previewError(drilledPodcastId()) : undefined;
	const focusedEpIdx = () =>
		episodes().length === 0 ? 0 : Math.min(focus(2), episodes().length - 1);
	const focusedEpisode = () => episodes()[focusedEpIdx()];

	const curLen = () =>
		depth() === 0
			? categories().length
			: depth() === 1
				? podcasts().length
				: episodes().length;

	const ensureFocus = () => {
		if (categories().length > 0 && focus(0) >= categories().length)
			nav.setDepthFocus(categories().length - 1, 0);
		if (podcasts().length > 0 && focus(1) >= podcasts().length)
			nav.setDepthFocus(podcasts().length - 1, 1);
		if (episodes().length > 0 && focus(2) >= episodes().length)
			nav.setDepthFocus(episodes().length - 1, 2);
	};
	onMount(ensureFocus);

	// Auto-fetch the featured-shows manifest on first mount (network failure is
	// non-fatal — the list stays empty until the user hits refresh).
	onMount(() => {
		discoverStore.refresh().catch(() => {});
	});

	onMount(() => {
		nav.registerResolver(`${nav.activeTab()}:${DEPTH_CENTER_PANE}`, (i) => {
			if (depth() === 0) return categories()[i]?.id;
			if (depth() === 1) return podcasts()[i]?.id;
			return episodes()[i]?.id;
		});
	});

	// ── helpers ────────────────────────────────────────────────────────────────
	const formatDate = (d: Date) => format(d, "MMM d, yyyy");

	/** The subscribed feed backing a podcast, if any (matched by directory id
	 *  or feed URL — a Discover show may already be subscribed). */
	const feedForPodcast = (p: Podcast) =>
		feedStore.feeds().find(
			(f) =>
				f.podcast.id === p.id ||
				(!!p.feedUrl && f.podcast.feedUrl === p.feedUrl),
		);

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
		audioNav.setSource(AudioSource.SEARCH, drilledPodcast()?.id);
	};

	// ── drill / open ───────────────────────────────────────────────────────────
	function open() {
		if (depth() === 0) {
			const c = focusedCategory();
			if (!c) return;
			discoverStore.setSelectedCategory(c.id);
			nav.pushDepth({ kind: "results", ctx: c.id, focus: 0 } as DepthFrame);
			nav.setActivePane(DEPTH_CENTER_PANE);
			return;
		}
		if (depth() === 1) {
			const pod = focusedPodcast();
			if (!pod) return;
			// Drill into the show's episode list WITHOUT subscribing — `l`,
			// right, and Enter open the episodes; `a` is the subscribe key.
			discoverStore.openEpisodes(pod).catch(() => {});
			nav.pushDepth({ kind: "episodes", ctx: pod.id, focus: 0 } as DepthFrame);
			nav.setActivePane(DEPTH_CENTER_PANE);
			return;
		}
		if (depth() >= 2) {
			const ep = focusedEpisode();
			if (ep) playEpisode(ep);
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
			if (depth() === 1) {
				const pod = focusedPodcast();
				if (pod) nav.toggleSelected(pod.id);
			}
			if (depth() >= 2) {
				const ep = focusedEpisode();
				if (ep) nav.toggleSelected(ep.id);
			}
		},
		download: () => {
			if (depth() !== 2) return;
			const pod = drilledPodcast();
			const ep = focusedEpisode();
			if (!pod || !ep) return;
			// Under its subscribed feed when already subscribed, otherwise as
			// an "unsubscribed show" download (mirrors Search).
			const feed = feedForPodcast(pod);
			if (feed) downloadStore.startDownload(ep, feed.id);
			else downloadStore.startUnsubscribedDownload(ep, pod);
		},
		"delete-download": () => {
			if (depth() !== 2) return;
			const ep = focusedEpisode();
			if (!ep) return;
			const id = ep.id;
			if (downloadStore.getDownloadStatus(id) === DownloadStatus.NONE) return;
			downloadStore.cancelDownload(id);
			downloadStore.removeDownload(id).catch(() => {});
		},
		// `a`/`x` — the dedicated subscribe/unsubscribe keys (enter/l now open
		// the episode list, so subscribing moved off open).
		subscribe: () => {
			if (depth() === 1) {
				const pod = focusedPodcast();
				if (pod && !pod.isSubscribed) discoverStore.subscribe(pod.id);
				return;
			}
			if (depth() >= 2) {
				const pod = drilledPodcast();
				if (pod && !pod.isSubscribed) discoverStore.subscribe(pod.id);
			}
		},
		unsubscribe: () => {
			if (depth() !== 1) return;
			const pod = focusedPodcast();
			if (pod?.isSubscribed) discoverStore.unsubscribe(pod.id);
		},
		refresh: () => {
			if (depth() >= 2) {
				const pod = drilledPodcast();
				if (pod) discoverStore.refreshEpisodes(pod).catch(() => {});
				return;
			}
			discoverStore.refresh().catch(() => {});
		},
	};
	function step(delta: number) {
		nav.move(delta, curLen());
		// keep the store's selected category synced with the focused row at depth 0
		if (depth() === 0) {
			const c = focusedCategory();
			if (c) discoverStore.setSelectedCategory(c.id);
		}
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
		i === lf && active
			? theme.surface
			: i === lf
				? theme.selectedListItemText ?? theme.text
				: theme.text;

	const currentLabel = () =>
		depth() === 0
			? "Categories"
			: depth() === 1
				? `${focusedCategory()?.name ?? "Discover"} · ${podcasts().length}`
				: `${drilledPodcast()?.title ?? "Episodes"} · ${episodes().length}`;

	// ── parent pane: previous-depth list (muted/blank at depth 0) ─────────────
	// Sibling <Show> blocks per depth (the known-good opentui disposal
	// pattern, mirrors Settings): a STABLE fragment root whose inner <Show>
	// children toggle on depth change, so the old subtree is disposed instead
	// of left orphaned next to the new one (single <Show with fallback> and
	// ternary root swaps both leak the previous root).
	const parentContent = () => (
		<>
			<Show when={depth() === 0}>
				<TabListPane muted />
			</Show>
			<Show when={depth() === 1}>
				<For each={categories()}>
					{(cat, index) => {
						const lf = () => nav.depthFocus(0);
						const ref = useScrollIntoView(() => index() === lf());
						return (
							<box
								ref={ref}
								flexDirection="row"
								gap={1}
								paddingRight={1}
								backgroundColor={focusBg(index(), lf(), false)}
							>
								<text fg={focusFg(index(), nav.depthFocus(0), false)}>
									{index() === nav.depthFocus(0) ? marker() : " "}
								</text>
								{nerd && (
									<text fg={focusFg(index(), nav.depthFocus(0), false)}>
										{cat.icon}
									</text>
								)}
								<text fg={focusFg(index(), nav.depthFocus(0), false)}>
									{cat.name}
								</text>
							</box>
						);
					}}
				</For>
			</Show>
			<Show when={depth() >= 2}>
				<For each={podcasts()}>
					{(podcast, index) => {
						const lf = () => nav.depthFocus(1);
						const ref = useScrollIntoView(() => index() === lf());
						return (
							<box
								ref={ref}
								flexDirection="row"
								gap={1}
								paddingRight={1}
								backgroundColor={focusBg(index(), lf(), false)}
							>
								<text fg={focusFg(index(), lf(), false)}>
									{index() === lf() ? marker() : " "}
								</text>
								<text wrapMode="none" truncate fg={focusFg(index(), lf(), false)}>
									{podcast.title}
								</text>
								<Show when={podcast.isSubscribed}>
									<text flexShrink={0} fg={muted()}>[+]</text>
								</Show>
							</box>
						);
					}}
				</For>
			</Show>
		</>
	);

	// ── current pane ───────────────────────────────────────────────────────────
	const currentContent = () => (
		<>
			{/* depth 0: categories */}
			<Show when={depth() === 0}>
				<For each={categories()}>
					{(cat, index) => {
						const lf = () => focusedCatIdx();
						const ref = useScrollIntoView(() => index() === lf());
						return (
							<box
								ref={ref}
								flexDirection="row"
								gap={1}
								paddingRight={1}
								backgroundColor={focusBg(index(), lf(), isActive())}
								onMouseDown={() => {
									nav.setActivePane(DEPTH_CENTER_PANE);
									nav.setDepthFocus(index(), 0);
									discoverStore.setSelectedCategory(cat.id);
								}}
							>
								<text fg={focusFg(index(), lf(), isActive())}>
									{index() === lf() ? marker() : " "}
								</text>
								{nerd && (
									<text fg={focusFg(index(), lf(), isActive())}>
										{cat.icon}
									</text>
								)}
								<text fg={focusFg(index(), lf(), isActive())}>{cat.name}</text>
							</box>
						);
					}}
				</For>
			</Show>
			{/* depth ≥1: results */}
			<Show when={depth() === 1}>
				<Show
					when={podcasts().length > 0}
					fallback={
						<box padding={1}>
							<Show
								when={discoverStore.isLoading()}
								fallback={
									<text fg={muted()}>No podcasts found. :refresh</text>
								}
							>
								<LoadingIndicator label="Discovering…" />
							</Show>
						</box>
					}
				>
					<For each={podcasts()}>
						{(podcast, index) => {
							const lf = () => focusedPodIdx();
							const ref = useScrollIntoView(() => index() === lf());
							return (
								<box
									ref={ref}
									flexDirection="column"
									gap={0}
									paddingRight={1}
									backgroundColor={focusBg(index(), lf(), isActive())}
									onMouseDown={() => {
										nav.setActivePane(DEPTH_CENTER_PANE);
										nav.setDepthFocus(index(), 1);
									}}
								>
									<box flexDirection="row" gap={1}>
										<text fg={focusFg(index(), lf(), isActive())}>
											{index() === lf() ? marker() : " "}
										</text>
										<text fg={focusFg(index(), lf(), isActive())}>
											{podcast.title}
										</text>
										<Show when={podcast.isSubscribed}>
											<text
												fg={index() === lf() ? theme.surface : theme.success}
											>
												[+]
											</text>
										</Show>
									</box>
									<Show when={podcast.author}>
										<text
											fg={index() === lf() ? theme.surface : muted()}
											paddingLeft={2}
										>
											by {podcast.author}
										</text>
									</Show>
								</box>
							);
						}}
					</For>
					<Show when={discoverStore.isLoading()}>
						<box paddingLeft={2} paddingTop={1}>
							<LoadingIndicator />
						</box>
					</Show>
				</Show>
			</Show>
			{/* depth ≥2: episodes of the drilled show (preview, no subscription) */}
			<Show when={depth() >= 2}>
				<Show when={episodesLoading()}>
					<box padding={1}>
						<LoadingIndicator label="Loading episodes…" />
					</box>
				</Show>
				<Show when={episodesError() && !episodesLoading()}>
					<box padding={1}>
						<text fg={theme.error}>{episodesError()}</text>
						<box height={1} />
						<text fg={muted()}>r: retry · h: back</text>
					</box>
				</Show>
				<Show
					when={
						!episodesLoading() && !episodesError() && episodes().length === 0
					}
				>
					<box padding={1}>
						<text fg={muted()}>No episodes found. :refresh</text>
					</box>
				</Show>
				<Show
					when={
						!episodesLoading() && !episodesError() && episodes().length > 0
					}
				>
					<For each={episodes()}>
						{(ep, index) => (
							<EpisodeRow
								episode={ep}
								index={index}
								focused={focusedEpIdx}
								active={isActive}
								selected={() => nav.isSelected(ep.id)}
								downloadLabel={() => downloadLabel(ep.id)}
								downloadColor={() => downloadColor(ep.id)}
								marker={marker}
								onMouseDown={() => {
									nav.setActivePane(DEPTH_CENTER_PANE);
									nav.setDepthFocus(index(), 2);
								}}
							/>
						)}
					</For>
				</Show>
			</Show>
		</>
	);

	// ── preview pane ───────────────────────────────────────────────────────────
	const previewContent = () =>
		depth() === 0 ? (
			// depth 0 preview: shows for the hovered category
			<Show
				when={focusedCategory()}
				fallback={
					<box padding={1}>
						<text fg={muted()}>No category focused</text>
					</box>
				}
			>
				{(cat) => (
					<box flexDirection="column" gap={0} padding={1}>
						<text fg={theme.textPrimary ?? theme.text}>
							<strong>{cat().name}</strong>
						</text>
						<Show when={(cat() as any).description}>
							<text fg={theme.textSecondary}>{(cat() as any).description}</text>
						</Show>
						<box height={1} />
						<Show
							when={podcasts().length > 0}
							fallback={
								<text fg={muted()}>
									No shows in this category yet. :refresh
								</text>
							}
						>
							<For each={podcasts()}>
								{(pod) => (
									<box flexDirection="column" gap={0}>
										<text fg={theme.text}>{pod.title}</text>
										<Show when={pod.author}>
											<text fg={muted()} paddingLeft={2}>
												by {pod.author}
											</text>
										</Show>
									</box>
								)}
							</For>
						</Show>
					</box>
				)}
			</Show>
		) : depth() === 1 ? (
			// depth 1 preview: hovered podcast + episode-list hint
			<Show
				when={focusedPodcast()}
				fallback={
					<box padding={1}>
						<text fg={muted()}>No podcast focused</text>
					</box>
				}
			>
				{(pod) => (
					<box flexDirection="column" gap={1} padding={1}>
						<text fg={theme.textPrimary ?? theme.text}>
							<strong>{pod().title}</strong>
						</text>
						<Show when={pod().author}>
							<text fg={muted()}>by {pod().author}</text>
						</Show>
						<Show when={pod().isSubscribed}>
							<text fg={theme.success}>✓ Subscribed · x: unsubscribe</text>
						</Show>
						<Show when={!pod().isSubscribed}>
							<text fg={theme.primary}>a: subscribe</text>
						</Show>
						<box height={1} />
						<text fg={theme.textSecondary}>
							{pod().description?.slice(0, 400) ?? "No description available."}
							{(pod().description?.length ?? 0) > 400 ? "…" : ""}
						</text>
						<Show when={(pod().categories ?? []).length > 0}>
							<box flexDirection="row" gap={1}>
								<For each={(pod().categories ?? []).slice(0, 4)}>
									{(cat) => <text fg={theme.warning}>[{cat}]</text>}
								</For>
							</box>
						</Show>
						<Show when={pod().feedUrl}>
							<text fg={muted()}>Feed: {pod().feedUrl}</text>
						</Show>
						<text fg={muted()}>Updated: {formatDate(pod().lastUpdated)}</text>
						<box height={1} />
						<text fg={muted()}>enter/l: episodes · h: back · r: refresh</text>
					</box>
				)}
			</Show>
		) : (
			// depth ≥2 preview: hovered episode (or loading/error/empty)
			<>
				<Show when={episodesLoading()}>
					<box padding={1}>
						<LoadingIndicator label="Loading episodes…" />
					</box>
				</Show>
				<Show when={episodesError() && !episodesLoading()}>
					<box padding={1}>
						<text fg={theme.error}>{episodesError()}</text>
						<box height={1} />
						<text fg={muted()}>r: retry · h: back</text>
					</box>
				</Show>
				<Show
					when={
						!episodesLoading() && !episodesError() && episodes().length === 0
					}
				>
					<box padding={1}>
						<text fg={muted()}>No episodes found.</text>
					</box>
				</Show>
				<Show
					when={
						!episodesLoading() &&
						!episodesError() &&
						episodes().length > 0 &&
						focusedEpisode()
					}
					fallback={
						<box padding={1}>
							<text fg={muted()}>No episode focused</text>
						</box>
					}
				>
					{(ep) => (
						<EpisodePreview
							episode={() => ep()}
							author={() => drilledPodcast()?.author}
							downloadLabel={() => downloadLabel(ep().id)}
							downloadColor={() => downloadColor(ep().id)}
							hint={() =>
								`enter: play · d: download${
									downloadStore.getDownloadStatus(ep().id) !==
									DownloadStatus.NONE
										? " · D: delete"
										: ""
								}${
									drilledPodcast()?.isSubscribed ? "" : " · a: subscribe"
								} · h: back`
							}
						/>
					)}
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

export { DiscoverPage };
