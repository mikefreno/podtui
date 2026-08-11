/**
 * SearchPage — yazi depth-stack view of podcast search.
 *
 *   depth 0 (current) — query input row + recent-searches list (navigable
 *                       with j/k when the input is defocused). Parent pane
 *                       shows the tab list (muted); preview shows a hint.
 *   depth 1 (current) — search results list. Parent pane shows the submitted
 *                       query (muted, read-only); preview shows the detail of
 *                       the focused result.
 *
 * Search scope: `tab` (search-scope-toggle) flips between shows and episodes
 * (clickable pills on the query depth too); toggling while viewing results
 * re-runs the current query in the new scope.
 *
 * Typed input owns its keys while `nav.inputFocused()` is true (the Shell
 * router yields). Escape defocuses the input (handled in Shell) so j/k/h
 * navigation resumes; `s` (the `search` action) refocuses it. Enter on the
 * input (or on a focused recent at depth 0) submits the query and pushes to
 * depth 1 (results). `h` pops: results→query, query→tab root.
 */

import {
	createSignal,
	createMemo,
	createEffect,
	For,
	Show,
	onMount,
	onCleanup,
} from "solid-js";
import { useSearchStore } from "@/stores/search";
import { useFeedStore } from "@/stores/feed";
import { useDownloadStore } from "@/stores/download";
import { useAudio } from "@/hooks/useAudio";
import { useAudioNavStore, AudioSource } from "@/stores/audio-nav";
import { DownloadStatus } from "@/types/episode";
import { useToast } from "@/ui/toast";
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
import type { KeybindActionName } from "@/context/KeybindContext";
import type { SearchResult, SearchScope } from "@/types/source";
import { PaneRow } from "@/components/PaneRow";
import { TabListPane } from "@/components/TabPanel";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { useScrollIntoView } from "@/hooks/useScrollIntoView";
import { useSelectionMarker } from "@/hooks/useSelectionMarker";
import { useInputFocusNav } from "@/hooks/useInputFocusNav";

export const SearchPaneCount = 1;

function SearchPage() {
	const searchStore = useSearchStore();
	const feedStore = useFeedStore();
	const downloadStore = useDownloadStore();
	const audio = useAudio();
	const audioNav = useAudioNavStore();
	const toast = useToast();
	const [inputValue, setInputValue] = createSignal("");
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const nav = useNavigation();
	const marker = useSelectionMarker();

	const stack = nav.depthStack;
	const depth = nav.currentDepth;
	const focus = (d: number = depth()) => nav.depthFocus(d);

	// depth 1's ctx carries the submitted query string.
	const submittedQuery = (): string => stack()[1]?.ctx ?? searchStore.query();

	// ── input focusing ────────────────────────────────────────────────────────
	// `inputFocused` is true while the query input is being typed in. The Shell
	// router yields keys to the <input> while this is true; Escape (in Shell)
	// sets it false so navigation resumes; `s` (search action) sets it true.
	//
	// The input's REAL focus is the source of truth for the flag:
	// useInputFocusNav (the same hook the Settings forms use) flips
	// `inputFocused` from the input's FOCUSED/BLURRED events, keeping the flag
	// and the renderable in lockstep. That matters when the user clicks OFF the
	// input: opentui's mouse dispatch auto-focuses the clicked target's nearest
	// focusable ancestor (a pane scrollbox), blurring the input. The BLURRED
	// event drops the flag, so the Shell router immediately resumes j/k/h
	// instead of swallowing keys with no input to receive them — no more
	// stuck "typing" state where Esc/j/k/s all do nothing.
	//
	// The depth stack still SEEDS the flag on transitions, since the query
	// depth defaults to typing: re-entering depth 0 (h back from results, or a
	// fresh mount) focuses the input; mounting at depth 1 (returning to the
	// tab after a search) stays list-navigation — a stuck-on flag there would
	// have the Shell yield j/k to a non-existent input. The depth STACK signal
	// is also written by focus moves (setDepthFocus), so gate the seed on the
	// depth VALUE via a memo: the effect must re-run only on an actual depth
	// transition. Without the memo every j/k at the query depth re-focuses the
	// input (undoing Escape), which keeps the recents list unreachable by
	// keyboard.
	onMount(() => nav.setInputFocused(depth() === 0));
	onCleanup(() => nav.setInputFocused(false));
	const focusNavRef = useInputFocusNav();
	const isQueryDepth = createMemo(() => depth() === 0);
	createEffect(() => {
		nav.setInputFocused(isQueryDepth());
	});

	// ── results (depth 1) ─────────────────────────────────────────────────────
	const results = () => searchStore.results();
	const focusedResultIdx = () =>
		results().length === 0 ? 0 : Math.min(focus(1), results().length - 1);
	const focusedResult = createMemo(() => {
		const list = results();
		if (list.length === 0) return undefined;
		return list[focusedResultIdx()];
	});

	// ── recents (depth 0) ────────────────────────────────────────────────────
	const recents = () => searchStore.history();
	const curLen = () => (depth() === 0 ? recents().length : results().length);

	const ensureFocus = () => {
		if (depth() === 1 && results().length > 0 && focus(1) >= results().length)
			nav.setDepthFocus(results().length - 1, 1);
	};
	onMount(ensureFocus);

	// Register a visual-mode resolver for the results list (depth 1).
	onMount(() => {
		const key = `${nav.activeTab()}:${DEPTH_CENTER_PANE}`;
		nav.registerResolver(key, (i) => {
			const r = results()[i];
			return r?.kind === "episode" ? r.episode.id : r?.podcast.id;
		});
	});

	// ── helpers ─────────────────────────────────────────────────────────────────
	const formatDate = (d: Date) => format(d, "MMM d, yyyy");

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

	const runSearch = (query: string) => {
		const q = query.trim();
		if (!q) return;
		searchStore.search(q).catch(() => {});
		nav.pushDepth({
			kind: "search:results",
			ctx: q,
			focus: 0,
		} as DepthFrame);
		nav.setActivePane(DEPTH_CENTER_PANE);
	};

	const handleSubmit = () => runSearch(inputValue());

	const selectRecent = (query: string) => {
		setInputValue(query);
		runSearch(query);
	};

	/** Set show/episode scope; when viewing results, re-run the current query
	 *  so the list switches immediately (the toggle is otherwise invisible on
	 *  a list of results). */
	const applyScope = (next: SearchScope) => {
		searchStore.setScope(next);
		if (depth() >= 1) {
			const q = submittedQuery() || inputValue().trim();
			if (q) searchStore.search(q).catch(() => {});
		}
	};
	const toggleScope = () =>
		applyScope(searchStore.scope() === "podcast" ? "episode" : "podcast");

	const handleSubscribe = async (result: SearchResult) => {
		// Actually add the feed to the feed store, then mark the result
		// subscribed. addFeed returns null when a feedless directory stub
		// (delisted show) can't be resolved — tell the user why.
		const feed = await feedStore
			.addFeed(result.podcast, result.sourceId)
			.catch(() => null);
		if (!feed && !result.podcast.feedUrl) {
			toast.show({
				title: "Can't subscribe",
				message:
					"No RSS feed is listed for this show and the feed couldn't be resolved. Try adding it by feed URL.",
				variant: "error",
			});
			return;
		}
		if (feed) searchStore.markSubscribed(result.podcast.id);
	};

	/** The subscribed feed backing a search result, if any (matched by
	 *  directory id or feed URL). */
	const feedForResult = (r: SearchResult) =>
		feedStore.feeds().find(
			(f) =>
				f.podcast.id === r.podcast.id ||
				(!!r.podcast.feedUrl && f.podcast.feedUrl === r.podcast.feedUrl),
		);

	/** Download the focused episode: under its subscribed feed when the show
	 *  is subscribed, otherwise as an "unsubscribed show" download (listed
	 *  under Unsubscribed Show Downloads in My Shows / the download manager). */
	const downloadFocusedEpisode = () => {
		if (depth() !== 1) return;
		const r = focusedResult();
		if (!r || r.kind !== "episode") return;
		const feed = feedForResult(r);
		if (feed) downloadStore.startDownload(r.episode, feed.id);
		else downloadStore.startUnsubscribedDownload(r.episode, r.podcast);
	};

	const playFocusedEpisode = () => {
		if (depth() !== 1) return;
		const r = focusedResult();
		if (!r || r.kind !== "episode") return;
		audio.play(r.episode).catch(() => {});
		audioNav.setSource(AudioSource.SEARCH, r.podcast.id);
	};

	const unsubscribeFocused = () => {
		if (depth() !== 1) return;
		const r = focusedResult();
		if (!r || !r.podcast.isSubscribed) return;
		const feed = feedForResult(r);
		if (feed) {
			feedStore.removeFeed(feed.id);
			downloadStore
				.removeDownloadsForFeed(feed.id, feed.podcast.feedUrl || undefined)
				.catch(() => {});
			searchStore.markUnsubscribed(r.podcast.id, r.podcast.feedUrl);
		}
	};

	// ── nav.action handler ──────────────────────────────────────────────────────
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
				const r = focusedResult();
				if (r)
					nav.toggleSelected(
						r.kind === "episode" ? r.episode.id : r.podcast.id,
					);
			}
		},
		download: () => downloadFocusedEpisode(),
		"delete-download": () => {
			if (depth() !== 1) return;
			const r = focusedResult();
			if (!r || r.kind !== "episode") return;
			const id = r.episode.id;
			if (downloadStore.getDownloadStatus(id) === DownloadStatus.NONE) return;
			downloadStore.cancelDownload(id);
			downloadStore.removeDownload(id).catch(() => {});
		},
		unsubscribe: () => unsubscribeFocused(),
		search: () => {
			// `s` refocuses the query input (typing mode) when on the query depth.
			if (depth() === 0) nav.setInputFocused(true);
		},
		"search-scope-toggle": () => toggleScope(),
		refresh: () => {
			const q = submittedQuery() || inputValue().trim();
			if (q) searchStore.search(q).catch(() => {});
		},
	};

	function step(delta: number) {
		nav.move(delta, curLen());
	}
	function open() {
		if (depth() === 0) {
			// Enter/l on a focused recent search → submit it and drill to results.
			const list = recents();
			const idx = Math.min(focus(0), list.length - 1);
			const q = list[idx];
			if (q) selectRecent(q);
			return;
		}
		if (depth() === 1) {
			const r = focusedResult();
			if (!r) return;
			if (r.kind === "episode" && r.podcast.isSubscribed) {
				// Subscribed show's episode → stream it (matches Feed/My Shows).
				playFocusedEpisode();
				return;
			}
			handleSubscribe(r);
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
	const inputActive = () => nav.inputFocused() && depth() === 0;
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

	// ── parent pane: previous-depth content (tab list at depth 0) ──────────────
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
			<Show when={depth() >= 1}>
				<box flexDirection="column" gap={1} padding={1}>
					<text fg={theme.textSecondary}>Query</text>
					<text fg={muted()}>{submittedQuery() || "(empty)"}</text>
					<box height={1} />
					<text fg={theme.textSecondary}>
						Scope · {searchStore.scope() === "episode" ? "episodes" : "shows"}
					</text>
					<text fg={muted()}>h: back to query</text>
				</box>
			</Show>
		</>
	);

	// ── current pane ────────────────────────────────────────────────────────────
	const currentContent = () => (
		<>
			<Show when={depth() === 0}>
				{/* query input row + recent searches */}
				<box flexDirection="column" gap={1} padding={1}>
					<box flexDirection="row" gap={1} alignItems="center">
						<text fg={muted()}>Query:</text>
						<input
							ref={focusNavRef}
							value={inputValue()}
							onInput={setInputValue}
							onSubmit={() => handleSubmit()}
							onMouseDown={(evt) => {
								// Clicking the input must focus it (typing mode).
								// preventDefault stops opentui's click auto-focus from
								// grabbing the pane scrollbox instead; setting the flag
								// drives the `focused` prop → renderable focus → the
								// useInputFocusNav FOCUSED handler.
								evt.preventDefault();
								nav.setInputFocused(true);
							}}
							onKeyDown={(evt) => {
								// While the input owns keys the Shell router never sees
								// Tab, so the scope toggle must be handled here (the
								// pills and the tab keybind cover the defocused cases).
								if (evt.name === "tab") {
									evt.preventDefault();
									toggleScope();
								}
							}}
							placeholder={
								searchStore.scope() === "episode"
									? "Enter episode, guest, topic..."
									: "Enter podcast name..."
							}
							focused={inputActive()}
							width={28}
							textColor={theme.text}
							focusedTextColor={theme.accent}
							cursorColor={theme.accent}
						/>
					</box>
					<box flexDirection="row" gap={1} alignItems="center">
						<text fg={theme.textSecondary}>Scope:</text>
						<box
							backgroundColor={
								searchStore.scope() === "podcast" ? theme.primary : undefined
							}
							onMouseDown={() => applyScope("podcast")}
						>
							<text
								fg={
									searchStore.scope() === "podcast"
										? theme.surface
										: muted()
								}
							>
								{" "}
								Shows{" "}
							</text>
						</box>
						<box
							backgroundColor={
								searchStore.scope() === "episode" ? theme.primary : undefined
							}
							onMouseDown={() => applyScope("episode")}
						>
							<text
								fg={
									searchStore.scope() === "episode"
										? theme.surface
										: muted()
								}
							>
								{" "}
								Episodes{" "}
							</text>
						</box>
						<text fg={muted()}>tab to toggle</text>
					</box>
					<Show when={searchStore.isSearching()}>
						<LoadingIndicator label="Searching…" />
					</Show>
					<Show when={searchStore.error()}>
						<text fg={theme.error}>{searchStore.error()}</text>
					</Show>
					<box height={1} />
					<text fg={theme.textSecondary}>Recent</text>
					<Show
						when={recents().length > 0}
						fallback={
							<text fg={muted()}>
								{inputActive()
									? "Enter to search"
									: "s to type · Enter to search"}
							</text>
						}
					>
						<For each={recents()}>
							{(query, index) => {
								const lf = () => focus(0);
								const ref = useScrollIntoView(() => index() === lf());
								// While the input is focused (typing), the list is not
								// in focus: no bg, no accent fg, no `❯` on any entry.
								const typing = () => inputActive();
								return (
									<box
										ref={ref}
										flexDirection="row"
										gap={1}
										paddingRight={1}
										backgroundColor={
											typing()
												? undefined
												: focusBg(index(), lf(), isActive())
										}
										onMouseDown={() => {
											nav.setActivePane(DEPTH_CENTER_PANE);
											nav.setDepthFocus(index(), 0);
											// A recent is an action, not an item: clicking
											// it re-runs that search (focus-only would be
											// invisible — the input still owns the keys).
											selectRecent(query);
										}}
									>
										<text
											fg={
												typing()
													? theme.text
													: focusFg(index(), lf(), isActive())
											}
										>
											{index() === lf() && !typing() ? marker() : " "}
										</text>
										<text
											fg={
												typing()
													? theme.text
													: focusFg(index(), lf(), isActive())
											}
										>
											{query}
										</text>
									</box>
								);
							}}
						</For>
					</Show>
					<box height={1} />
					<text fg={muted()}>
						{inputActive()
							? "Enter to search · Esc to defocus"
							: "j/k recents · s to type · tab scope · h back"}
					</text>
				</box>
			</Show>
			<Show when={depth() >= 1}>
				{/* results list */}
				<Show
					when={results().length > 0}
					fallback={
						<box padding={1}>
							<Show
								when={searchStore.isSearching()}
								fallback={
									<text fg={muted()}>
										{searchStore.query()
											? "No results found"
											: searchStore.scope() === "episode"
												? "Enter a search term to find episodes"
												: "Enter a search term to find podcasts"}
									</text>
								}
							>
								<LoadingIndicator label="Searching…" />
							</Show>
						</box>
					}
				>
					<For each={results()}>
						{(result, index) => {
							const fi = () => focusedResultIdx();
							const ref = useScrollIntoView(() => index() === fi());
							// Episode download status badge ("" when absent).
							const dlLabel = () =>
								result.kind === "episode"
									? downloadLabel(result.episode.id)
									: "";
							const dlEpId = () =>
								result.kind === "episode" ? result.episode.id : "";
							return (
								<box
									ref={ref}
									flexDirection="column"
									gap={0}
									paddingRight={1}
									backgroundColor={focusBg(index(), fi(), isActive())}
									onMouseDown={() => {
										nav.setActivePane(DEPTH_CENTER_PANE);
										nav.setDepthFocus(index(), 1);
									}}
								>
									<box flexDirection="row" gap={1}>
										<text fg={focusFg(index(), fi(), isActive())}>
											{index() === fi() ? marker() : " "}
										</text>
										<text fg={focusFg(index(), fi(), isActive())}>
											{result.kind === "episode"
												? result.episode.title
												: result.podcast.title}
										</text>
										<Show when={dlLabel()}>
											<text fg={downloadColor(dlEpId())}>
												{dlLabel()}
											</text>
										</Show>
										<Show when={result.podcast.isSubscribed}>
											<text
												fg={index() === fi() ? theme.surface : theme.success}
											>
												[+]
											</text>
										</Show>
									</box>
									{result.kind === "episode" ? (
										<text
											fg={index() === fi() ? theme.surface : muted()}
											paddingLeft={2}
										>
											{result.podcast.title} ·{" "}
											{formatDate(result.episode.pubDate)}
										</text>
									) : (
										<Show when={result.podcast.author}>
											<text
												fg={index() === fi() ? theme.surface : muted()}
												paddingLeft={2}
											>
												by {result.podcast.author}
											</text>
										</Show>
									)}
								</box>
							);
						}}
					</For>
				</Show>
			</Show>
		</>
	);

	// ── preview pane ────────────────────────────────────────────────────────────
	const previewContent = () =>
		depth() === 0 ? (
			<box flexDirection="column" gap={1} padding={1}>
				<text fg={theme.textPrimary ?? theme.text}>
					<strong>Search</strong>
				</text>
				<text fg={muted()}>Type a query, press Enter to search.</text>
				<text fg={muted()}>
					Tab toggles Shows ↔ Episodes (episode search finds guests
					and topics).
				</text>
				<text fg={muted()}>Esc defocuses the input; h goes back.</text>
				<box height={1} />
				<text fg={theme.textSecondary}>Recent · {recents().length}</text>
				<For each={recents().slice(0, 6)}>
					{(q) => <text fg={muted()}>‣ {q}</text>}
				</For>
			</box>
		) : (
			<Show
				when={focusedResult()}
				fallback={
					<box padding={1}>
						<text fg={muted()}>No result focused</text>
					</box>
				}
			>
				{(result) => {
					const r = result();
					if (r.kind === "episode") {
						return (
							<box flexDirection="column" gap={1} padding={1}>
								<text fg={theme.text}>
									<strong>{r.episode.title}</strong>
								</text>
								<text fg={theme.textSecondary}>{r.podcast.title}</text>
								<Show when={r.podcast.author}>
									<text fg={muted()}>by {r.podcast.author}</text>
								</Show>
								<Show when={r.episode.description}>
									<text fg={theme.textSecondary}>
										{r.episode.description!.slice(0, 400)}
										{(r.episode.description?.length ?? 0) > 400 ? "…" : ""}
									</text>
								</Show>
								<box flexDirection="row" gap={2}>
									<text fg={muted()}>
										Published: {formatDate(r.episode.pubDate)}
									</text>
									<Show when={downloadLabel(r.episode.id)}>
										<text fg={downloadColor(r.episode.id)}>
											{downloadLabel(r.episode.id)}
										</text>
									</Show>
								</box>
								<Show when={(r.podcast.categories ?? []).length > 0}>
									<box flexDirection="row" gap={1}>
										<For each={(r.podcast.categories ?? []).slice(0, 4)}>
											{(cat) => <text fg={theme.warning}>[{cat}]</text>}
										</For>
									</box>
								</Show>
								<Show when={r.sourceName}>
									<text fg={muted()}>Source: {r.sourceName}</text>
								</Show>
								<box height={1} />
								<Show when={!r.podcast.isSubscribed}>
									<text fg={theme.primary}>[+] Subscribe (enter)</text>
								</Show>
								<Show when={r.podcast.isSubscribed}>
									<text fg={theme.success}>
										Subscribed · x: unsubscribe
									</text>
								</Show>
								<box height={1} />
								<Show
									when={r.podcast.isSubscribed}
									fallback={
										<text fg={muted()}>
											enter: subscribe · d: download · h: back to query
										</text>
									}
								>
									<text fg={muted()}>
										enter: play · d: download · x: unsubscribe
										{downloadStore.getDownloadStatus(r.episode.id) !==
										DownloadStatus.NONE
											? " · D: delete"
											: ""}{" "}
										· h: back to query
									</text>
								</Show>
							</box>
						);
					}
					return (
						<box flexDirection="column" gap={1} padding={1}>
							<text fg={theme.text}>
								<strong>{r.podcast.title}</strong>
							</text>
							<Show when={r.podcast.author}>
								<text fg={muted()}>by {r.podcast.author}</text>
							</Show>
							<Show when={r.podcast.description}>
								<text fg={theme.textSecondary}>
									{r.podcast.description!.slice(0, 400)}
									{(r.podcast.description?.length ?? 0) > 400 ? "…" : ""}
								</text>
							</Show>
							<Show when={(r.podcast.categories ?? []).length > 0}>
								<box flexDirection="row" gap={1}>
									<For each={(r.podcast.categories ?? []).slice(0, 4)}>
										{(cat) => <text fg={theme.warning}>[{cat}]</text>}
									</For>
								</box>
							</Show>
							<text fg={muted()}>
								Feed:{" "}
								{r.podcast.feedUrl ||
									"not listed by source — resolves on subscribe"}
							</text>
							<text fg={muted()}>
								Updated: {formatDate(r.podcast.lastUpdated)}
							</text>
							<Show when={r.sourceName}>
								<text fg={muted()}>Source: {r.sourceName}</text>
							</Show>
							<box height={1} />
							<Show when={!r.podcast.isSubscribed}>
								<text fg={theme.primary}>[+] Subscribe (enter)</text>
							</Show>
							<Show when={r.podcast.isSubscribed}>
								<text fg={theme.success}>
									Subscribed · x: unsubscribe
								</text>
							</Show>
							<box height={1} />
							<text fg={muted()}>
								enter: subscribe
								{r.podcast.isSubscribed ? " · x: unsubscribe" : ""}{" "}
								· h: back to query
							</text>
						</box>
					);
				}}
			</Show>
		);

	const currentLabel = () =>
		depth() === 0
			? `Search · ${recents().length} recent`
			: `Results (${searchStore.scope() === "episode" ? "episodes" : "shows"}) · ${results().length}`;

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

export { SearchPage };
