/**
 * SearchPage — yazi-style 3-pane view.
 *
 *   pane 0 (parent)  — query input with recent-search history (clickable)
 *   pane 1 (current) — search results list (navigate j/k)
 *   pane 2 (preview)  — detail of the focused search result
 *
 * The Shell resets activePane to CURRENT(1) on tab enter so the user lands on
 * the results pane. Swipe left (h) to pane 0 to type a query — the Shell
 * router skips keys while `nav.inputFocused()` is true so the `<input>`
 * element captures typing natively. Press Enter (onSubmit) to search and
 * auto-swipe to the results pane.
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
	PaneSlot,
	type PaneId,
} from "@/context/NavigationContext";
import { on, off } from "@/utils/event-bus";
import type { KeybindActionName } from "@/context/KeybindContext";
import type { SearchResult } from "@/types/source";
import { PANE_RATIO } from "@/utils/navigation";

export const SearchPaneCount = 3;

function SearchPage() {
	const searchStore = useSearchStore();
	const [inputValue, setInputValue] = createSignal("");
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const nav = useNavigation();

	const INPUT = PaneSlot.PARENT; // 0
	const RESULTS = PaneSlot.CURRENT; // 1
	const DETAIL = PaneSlot.PREVIEW; // 2

	const results = () => searchStore.results();

	// The focused result tracks pane 1's focused row.
	const focusedResult = createMemo(() => {
		const list = results();
		if (list.length === 0) return undefined;
		const idx = Math.min(nav.focusedIndex(RESULTS), list.length - 1);
		return list[idx];
	});

	// Register a resolver so visual-mode range selection grows by result id.
	onMount(() => {
		nav.registerResolver(
			`${nav.activeTab()}:${RESULTS}`,
			(i) => results()[i]?.podcast.id,
		);
		const unsub = on("nav.action", () => {
			nav.registerResolver(
				`${nav.activeTab()}:${RESULTS}`,
				(i) => results()[i]?.podcast.id,
			);
		});
		onCleanup(() => unsub());
	});

	// Keep results focus in range after searches complete.
	const ensureFocus = () => {
		const list = results();
		if (list.length === 0) return;
		const cur = nav.focusedIndex(RESULTS);
		if (cur >= list.length) nav.setFocusedIndex(RESULTS, list.length - 1);
	};
	onMount(ensureFocus);

	// ── input pane: set inputFocused so Shell router yields keys to <input> ─────
	createEffect(() => {
		const isInputPane = nav.activePane() === INPUT;
		nav.setInputFocused(isInputPane);
	});
	onMount(() => {
		onCleanup(() => nav.setInputFocused(false));
	});

	// ── helpers ─────────────────────────────────────────────────────────────────
	const formatDate = (d: Date) => format(d, "MMM d, yyyy");

	const handleSubmit = () => {
		const query = inputValue().trim();
		if (!query) return;
		searchStore.search(query).catch(() => {});
		nav.setFocusedIndex(RESULTS, 0);
		nav.setActivePane(RESULTS);
	};

	const handleHistorySelect = (query: string) => {
		setInputValue(query);
		searchStore.search(query).catch(() => {});
		nav.setFocusedIndex(RESULTS, 0);
		nav.setActivePane(RESULTS);
	};

	const handleSubscribe = (result: SearchResult) => {
		searchStore.markSubscribed(result.podcast.id);
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
			if (p === RESULTS || p === DETAIL) {
				const result = focusedResult();
				if (result) handleSubscribe(result);
			}
		},
		"toggle-select": (p) => {
			if (p === RESULTS) {
				const result = focusedResult();
				if (result) nav.toggleSelected(result.podcast.id);
			}
		},
		search: () => {
			nav.setActivePane(INPUT);
		},
		refresh: () => {
			if (inputValue().trim()) {
				searchStore.search(inputValue().trim()).catch(() => {});
			}
		},
	};

	function len(pane: PaneId): number {
		if (pane === RESULTS) return results().length;
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
			{/* ── pane 0: query input ──────────────────────────────────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.parent} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>Search</text>
				</box>
				<scrollbox
					height="100%"
					focused={false}
					border
					borderColor={border(INPUT)}
					backgroundColor={theme.background}
				>
					<box flexDirection="column" gap={1} padding={1}>
						<box flexDirection="row" gap={1} alignItems="center">
							<text fg={muted()}>Query:</text>
							<input
								value={inputValue()}
								onInput={setInputValue}
								onSubmit={() => handleSubmit()}
								placeholder="Enter podcast name..."
								focused={isActive(INPUT)}
								width={28}
							/>
						</box>
						<text fg={muted()}>Enter to search · h/l: panes</text>

						<Show when={searchStore.isSearching()}>
							<text fg={theme.warning}>Searching...</text>
						</Show>
						<Show when={searchStore.error()}>
							<text fg={theme.error}>{searchStore.error()}</text>
						</Show>

						<box height={1} />
						<text fg={theme.textSecondary}>Recent</text>
						<Show
							when={searchStore.history().length > 0}
							fallback={<text fg={muted()}>No recent searches</text>}
						>
							<For each={searchStore.history().slice(0, 12)}>
								{(query) => (
									<box
										flexDirection="row"
										paddingLeft={1}
										onMouseDown={() => handleHistorySelect(query)}
									>
										<text fg={muted()}>
											{">"} {query}
										</text>
									</box>
								)}
							</For>
						</Show>
					</box>
				</scrollbox>
			</box>

			{/* ── pane 1: results ──────────────────────────────────────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.current} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>Results · {results().length}</text>
				</box>
				<scrollbox
					height="100%"
					focused={isActive(RESULTS)}
					border
					borderColor={border(RESULTS)}
					backgroundColor={theme.background}
				>
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
							{(result, index) => (
								<box
									flexDirection="column"
									gap={0}
									paddingLeft={1}
									paddingRight={1}
									backgroundColor={focusBg(index(), RESULTS)}
									onMouseDown={() => {
										nav.setActivePane(RESULTS);
										nav.setFocusedIndex(RESULTS, index());
									}}
								>
									<box flexDirection="row" gap={1}>
										<text fg={focusFg(index(), RESULTS)}>
											{index() === nav.focusedIndex(RESULTS) ? "❯" : " "}
										</text>
										<text fg={focusFg(index(), RESULTS)}>
											{result.podcast.title}
										</text>
										<Show when={result.podcast.isSubscribed}>
											<text
												fg={
													index() === nav.focusedIndex(RESULTS)
														? theme.surface
														: theme.success
												}
											>
												[+]
											</text>
										</Show>
									</box>
									<Show when={result.podcast.author}>
										<text
											fg={
												index() === nav.focusedIndex(RESULTS)
													? theme.surface
													: muted()
											}
											paddingLeft={2}
										>
											by {result.podcast.author}
										</text>
									</Show>
								</box>
							)}
						</For>
					</Show>
				</scrollbox>
			</box>

			{/* ── pane 2: detail ───────────────────────────────────────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.preview} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>Detail</text>
				</box>
				<scrollbox
					height="100%"
					focused={isActive(DETAIL)}
					border
					borderColor={border(DETAIL)}
					backgroundColor={theme.background}
				>
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
										{(result().podcast.description?.length ?? 0) > 400
											? "…"
											: ""}
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
								<text fg={muted()}>enter: subscribe h/l: panes</text>
							</box>
						)}
					</Show>
				</scrollbox>
			</box>
		</box>
	);
}

export { SearchPage };
