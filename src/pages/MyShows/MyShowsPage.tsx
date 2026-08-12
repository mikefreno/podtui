/**
 * MyShowsPage — yazi depth-stack view of subscribed shows.
 *
 *   depth 0 (current) — subscribed shows. Parent pane shows the muted
 *                       placeholder (1/5 slot kept).
 *   depth 1 (current) — episodes of the drilled show. Parent pane = shows.
 *   preview            — detail of the hovered item in the current column.
 *
 * Depth 1 ends with a "[Fetch More]" row (same preference-driven behavior
 * as the Feed tab) that loads the next batch of episodes for that show.
 *
 * Renders entirely through `<PaneRow>`; no bespoke 3-column flexbox JSX
 * remains. `l`/Enter drills in (show → episodes); `h` pops a depth (noop at
 * 0). j/k move only within the current column.
 */

import { createMemo, createEffect, For, Show, onMount, onCleanup } from "solid-js";
import { useFeedStore } from "@/stores/feed";
import { useDownloadStore } from "@/stores/download";
import { useAppStore } from "@/stores/app";
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
import { NF_ICONS, supportsNerdFonts } from "@/utils/nerd-fonts";
import type { KeybindActionName } from "@/context/KeybindContext";
import type { Episode, DownloadedEpisode } from "@/types/episode";
import type { Feed } from "@/types/feed";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { PaneRow } from "@/components/PaneRow";
import { TabListPane } from "@/components/TabPanel";
import { useScrollIntoView } from "@/hooks/useScrollIntoView";
import { useSelectionMarker } from "@/hooks/useSelectionMarker";

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

	// Total depth-0 rows: subscribed shows + unsubscribed-show downloads.
	const depth0Count = () => shows().length + unsubs().length;

	const focusedShowIdx = () =>
		shows().length === 0 ? 0 : Math.min(focus(0), shows().length - 1);
	/** True when the depth-0 cursor sits on an unsubscribed-show download
	 *  row (past the shows list). */
	const focusedOnUnsub = () =>
		depth() === 0 && focus(0) >= shows().length && unsubs().length > 0;
	const focusedUnsub = (): DownloadedEpisode | undefined => {
		if (!focusedOnUnsub()) return undefined;
		return unsubs()[Math.min(focus(0) - shows().length, unsubs().length - 1)];
	};
	const selectedShow = (): Feed | undefined => {
		if (focusedOnUnsub()) return undefined;
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
	// counterpart to the Feed page's row (which loads every feed). manual
	// mode: Enter on the row. auto mode: reaching the bottom row fetches
	// automatically (see the effect below).
	const fetchMoreMode = () => app.state().preferences.fetchMoreMode ?? "auto";
	const showFetchMore = () =>
		depth() >= 1 &&
		!!drilledShowId() &&
		feedStore.hasMoreEpisodes(drilledShowId());
	// Total navigable rows at depth 1: episodes + the optional Fetch More row.
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
	const moreRef = useScrollIntoView(() => focusedOnMore());

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

	// Auto mode: reaching the bottom of a drilled show's list loads its next
	// batch. Guarded by isLoadingMore so concurrent loads never stack.
	createEffect(() => {
		if (depth() < 1) return;
		if (fetchMoreMode() !== "auto") return;
		if (!showFetchMore()) return;
		if (feedStore.isLoadingMore()) return;
		if (focusedRow() < rowCount() - 1) return;
		feedStore.loadMoreEpisodes(drilledShowId()).catch(() => {});
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
	const focusBg = (i: number, lf: number, active: boolean) =>
		i === lf && active ? theme.primary : i === lf ? theme.border : undefined;
	const focusFg = (i: number, lf: number, active: boolean) =>
		i === lf && active
			? theme.surface
			: i === lf
				? theme.selectedListItemText ?? theme.text
				: theme.text;
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
						{(feed, index) => {
							const lf = () => focusedShowIdx();
							const ref = useScrollIntoView(() => index() === lf());
							const wlScope =
								app.state().preferences.autoDownloadScope === "whitelist";
							const wlInList = (
								app.state().preferences.autoDownloadWhitelist ?? []
							).includes(feed.id);
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
									}}
								>
									<text fg={focusFg(index(), lf(), isActive())}>
										{index() === lf() ? marker() : " "}
									</text>
									<text fg={focusFg(index(), lf(), isActive())}>
										{showTitle(feed)}
									</text>
									<text fg={index() === lf() ? theme.surface : muted()}>
										({feed.episodes.length})
									</text>
									<Show when={wlScope}>
										<text
											fg={
												index() === lf()
													? theme.surface
													: wlInList
														? theme.warning
														: muted()
											}
										>
											{wlInList ? "●" : "○"}
										</text>
									</Show>
								</box>
							);
						}}
					</For>
					<Show when={unsubs().length > 0}>
						<box paddingLeft={1} paddingTop={1}>
							<text fg={theme.textSecondary}>
								Unsubscribed Show Downloads
							</text>
						</box>
						<For each={unsubs()}>
							{(d, index) => {
								// Rows continue after the shows list.
								const rowIdx = () => shows().length + index();
								const lf = () => nav.depthFocus(0);
								const ref = useScrollIntoView(() => rowIdx() === lf());
								return (
									<box
										ref={ref}
										flexDirection="column"
										gap={0}
										paddingRight={1}
										backgroundColor={focusBg(rowIdx(), lf(), isActive())}
										onMouseDown={() => {
											nav.setActivePane(DEPTH_CENTER_PANE);
											nav.setDepthFocus(rowIdx(), 0);
										}}
									>
										<box flexDirection="row" gap={1}>
											<text
												flexShrink={0}
												fg={focusFg(rowIdx(), lf(), isActive())}
											>
												{rowIdx() === lf() ? marker() : " "}
											</text>
											<text
												wrapMode="none"
												truncate
												fg={focusFg(rowIdx(), lf(), isActive())}
											>
												{d.episodeTitle ?? d.episodeId}
											</text>
											<Show when={downloadLabel(d.episodeId)}>
												<text
													flexShrink={0}
													fg={downloadColor(d.episodeId)}
												>
													{downloadLabel(d.episodeId)}
												</text>
											</Show>
										</box>
										<box paddingLeft={2}>
											<text
												wrapMode="none"
												truncate
												fg={
													rowIdx() === lf()
														? theme.surface
														: theme.textSecondary
												}
											>
												{d.podcastTitle ?? d.feedId}
											</text>
										</box>
									</box>
								);
							}}
						</For>
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
					<For each={episodes()}>
						{(ep, index) => {
							const lf = () => focusedEpIdx();
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
										<text
											flexShrink={0}
											fg={focusFg(index(), lf(), isActive())}
										>
											{index() === lf() ? marker() : " "}
										</text>
										<text
											wrapMode="none"
											truncate
											fg={focusFg(index(), lf(), isActive())}
										>
											{ep.episodeNumber ? `#${ep.episodeNumber} ` : ""}
											{ep.title}
										</text>
									</box>
									<box flexDirection="row" gap={2} paddingLeft={2}>
										<text
											flexShrink={0}
											fg={index() === lf() ? theme.surface : theme.info}
										>
											{formatDate(ep.pubDate)}
										</text>
										<text
											flexShrink={0}
											fg={index() === lf() ? theme.surface : muted()}
										>
											{formatDuration(ep.duration)}
										</text>
										<Show when={nav.isSelected(ep.id)}>
											<text flexShrink={0} fg={theme.warning}>
												●
											</text>
										</Show>
										<Show when={downloadLabel(ep.id)}>
											<text flexShrink={0} fg={downloadColor(ep.id)}>
												{downloadLabel(ep.id)}
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
							backgroundColor={focusBg(
								episodes().length,
								focusedRow(),
								isActive(),
							)}
							onMouseDown={() => {
								nav.setActivePane(DEPTH_CENTER_PANE);
								nav.setDepthFocus(episodes().length, 1);
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
				</Show>
			</Show>
		</>
	);

	// ── preview pane ───────────────────────────────────────────────────────────
	const previewContent = () =>
		depth() === 0 ? (
			// depth 0 preview: hovered unsubscribed-show download, else the
			// hovered show.
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
									{show().podcast.description?.slice(0, 400) ??
										"No description."}
								</text>
								<box height={1} />
								<text fg={muted()}>
									enter/l: open · h: back · x: unsubscribe
									{app.state().preferences.autoDownloadScope ===
									"whitelist"
										? (app.state().preferences.autoDownloadWhitelist ??
											[]
										  ).includes(show().id)
											? " · w: un-whitelist"
											: " · w: whitelist"
										: ""}
								</text>
							</box>
						)}
					</Show>
				}
			>
				{(d) => (
					<box flexDirection="column" gap={1} padding={1}>
						<text fg={theme.textPrimary ?? theme.text}>
							<strong>{d().episodeTitle ?? d().episodeId}</strong>
						</text>
						<text fg={theme.textSecondary}>
							{d().podcastTitle ?? d().feedId}
						</text>
						<box flexDirection="row" gap={2}>
							<Show when={d().pubDate}>
								<text fg={theme.info}>
									{formatDate(new Date(d().pubDate!))}
								</text>
							</Show>
							<Show when={downloadLabel(d().episodeId)}>
								<text fg={downloadColor(d().episodeId)}>
									{downloadLabel(d().episodeId)}
								</text>
							</Show>
						</box>
						<text fg={muted()}>
							Downloaded from episode search — the show is not
							subscribed.
						</text>
						<box height={1} />
						<text fg={muted()}>
							enter: play · D: delete download · h: back
						</text>
					</box>
				)}
			</Show>
		) : (
			// depth ≥1 preview: hovered episode (or the Fetch More row)
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
									: "Load the next batch of older episodes for this show (Enter)."}
						</text>
						<box height={1} />
						<text fg={muted()}>enter: load more · h back</text>
					</box>
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
						<text fg={muted()}>
							enter: play · d: download
							{downloadStore.getDownloadStatus(ep().id) !==
							DownloadStatus.NONE
								? " · D: delete"
								: ""}
							{app.state().preferences.autoDownloadScope === "whitelist"
								? (app.state().preferences.autoDownloadWhitelist ?? []).includes(
										drilledShowId(),
									)
									? " · w: un-whitelist"
									: " · w: whitelist"
								: ""}{" "}
							· space: select · h: back
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
