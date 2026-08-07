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
import type { SearchResult } from "@/types/source";
import { YaziPaneRow } from "@/components/YaziPaneRow";
import { TabListPane } from "@/components/TabPanel";

export const SearchPaneCount = 1;

function SearchPage() {
	const searchStore = useSearchStore();
	const [inputValue, setInputValue] = createSignal("");
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const nav = useNavigation();

	const stack = nav.depthStack;
	const depth = nav.currentDepth;
	const focus = (d: number = depth()) => nav.depthFocus(d);

	// depth 1's ctx carries the submitted query string.
	const submittedQuery = (): string => stack()[1]?.ctx ?? searchStore.query();

	// ── input focusing ────────────────────────────────────────────────────────
	// `inputFocused` is true while the query input is being typed in. The Shell
	// router yields keys to the <input> while this is true; Escape (in Shell)
	// sets it false so navigation resumes; `s` (search action) sets it true.
	// Depth transitions also drive it: typing is the default on the query depth.
	let prevDepth = depth();
	onMount(() => nav.setInputFocused(true));
	onCleanup(() => nav.setInputFocused(false));
	createEffect(() => {
		const d = depth();
		if (d !== prevDepth) {
			nav.setInputFocused(d === 0);
			prevDepth = d;
		}
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
		nav.registerResolver(key, (i) => results()[i]?.podcast.id);
	});

	// ── helpers ─────────────────────────────────────────────────────────────────
	const formatDate = (d: Date) => format(d, "MMM d, yyyy");

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

	const handleSubscribe = (result: SearchResult) => {
		searchStore.markSubscribed(result.podcast.id);
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
				if (r) nav.toggleSelected(r.podcast.id);
			}
		},
		search: () => {
			// `s` refocuses the query input (typing mode) when on the query depth.
			if (depth() === 0) nav.setInputFocused(true);
		},
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
			if (r) handleSubscribe(r);
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
		i === listFocus && active ? theme.surface : theme.text;

	// ── parent pane: previous-depth content (tab list at depth 0) ──────────────
	const parentContent = () => (
		<Show when={depth() >= 1} fallback={<TabListPane muted />}>
			<box flexDirection="column" gap={1} padding={1}>
				<text fg={theme.textSecondary}>Query</text>
				<text fg={muted()}>{submittedQuery() || "(empty)"}</text>
				<box height={1} />
				<text fg={muted()}>h: back to query</text>
			</box>
		</Show>
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
							value={inputValue()}
							onInput={setInputValue}
							onSubmit={() => handleSubmit()}
							placeholder="Enter podcast name..."
							focused={inputActive()}
							width={28}
						/>
					</box>
					<Show when={searchStore.isSearching()}>
						<text fg={theme.warning}>Searching...</text>
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
								return (
									<box
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
										<text fg={focusFg(index(), lf(), isActive())}>{query}</text>
									</box>
								);
							}}
						</For>
					</Show>
					<box height={1} />
					<text fg={muted()}>
						{inputActive()
							? "Enter to search · Esc to defocus"
							: "j/k recents · s to type · h back"}
					</text>
				</box>
			</Show>
			<Show when={depth() >= 1}>
				{/* results list */}
				<Show
					when={results().length > 0}
					fallback={
						<box padding={1}>
							<text fg={muted()}>
								{searchStore.query()
									? "No results found"
									: "Enter a search term to find podcasts"}
							</text>
						</box>
					}
				>
					<For each={results()}>
						{(result, index) => {
							const fi = () => focusedResultIdx();
							return (
								<box
									flexDirection="column"
									gap={0}
									paddingLeft={1}
									paddingRight={1}
									backgroundColor={focusBg(index(), fi(), isActive())}
									onMouseDown={() => {
										nav.setActivePane(DEPTH_CENTER_PANE);
										nav.setDepthFocus(index(), 1);
									}}
								>
									<box flexDirection="row" gap={1}>
										<text fg={focusFg(index(), fi(), isActive())}>
											{index() === fi() ? "❯" : " "}
										</text>
										<text fg={focusFg(index(), fi(), isActive())}>
											{result.podcast.title}
										</text>
										<Show when={result.podcast.isSubscribed}>
											<text fg={index() === fi() ? theme.surface : theme.success}>
												[+]
											</text>
										</Show>
									</box>
									<Show when={result.podcast.author}>
										<text
											fg={index() === fi() ? theme.surface : muted()}
											paddingLeft={2}
										>
											by {result.podcast.author}
										</text>
									</Show>
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
				{(result) => (
					<box flexDirection="column" gap={1} padding={1}>
						<text fg={theme.text}>
							<strong>{result().podcast.title}</strong>
						</text>
						<Show when={result().podcast.author}>
							<text fg={muted()}>by {result().podcast.author}</text>
						</Show>
						<Show when={result().podcast.description}>
							<text fg={theme.textSecondary}>
								{result().podcast.description!.slice(0, 400) ??
									"No description available."}
								{(result().podcast.description?.length ?? 0) > 400 ? "…" : ""}
							</text>
						</Show>
						<Show when={(result().podcast.categories ?? []).length > 0}>
							<box flexDirection="row" gap={1}>
								<For each={(result().podcast.categories ?? []).slice(0, 4)}>
									{(cat) => <text fg={theme.warning}>[{cat}]</text>}
								</For>
							</box>
						</Show>
						<text fg={muted()}>Feed: {result().podcast.feedUrl}</text>
						<text fg={muted()}>
							Updated: {formatDate(result().podcast.lastUpdated)}
						</text>
						<Show when={result().sourceName}>
							<text fg={muted()}>Source: {result().sourceName}</text>
						</Show>
						<box height={1} />
						<Show when={!result().podcast.isSubscribed}>
							<text fg={theme.primary}>[+] Subscribe (enter)</text>
						</Show>
						<Show when={result().podcast.isSubscribed}>
							<text fg={theme.success}>Already subscribed</text>
						</Show>
						<box height={1} />
						<text fg={muted()}>enter: subscribe · h: back to query</text>
					</box>
				)}
			</Show>
		);

	const currentLabel = () =>
		depth() === 0
			? `Search · ${recents().length} recent`
			: `Results · ${results().length}`;

	return (
		<YaziPaneRow
			parent={parentContent}
			current={currentContent}
			preview={previewContent}
			parentLabel={() => (depth() >= 1 ? "Query" : "Up")}
			currentLabel={currentLabel}
			previewLabel="Detail"
			focused={isActive}
		/>
	);
}

export { SearchPage };
