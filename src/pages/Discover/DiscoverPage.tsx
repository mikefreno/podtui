/**
 * DiscoverPage — yazi-style 3-pane view.
 *
 *   pane 0 (parent)  — category list (the "containers")
 *   pane 1 (current) — podcast results for the focused category (landing pane)
 *   pane 2 (preview) — detail of the focused podcast + subscribe action
 *
 * The Shell resets activePane to CURRENT(1) on tab enter. h/l swipe between
 * panes; j/k move within; Enter subscribes to the focused podcast; r refreshes.
 * Yazi [1,4,3] grow ratio. yazi-authentic parent|current|preview ordering.
 */

import { createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { useDiscoverStore, DISCOVER_CATEGORIES } from "@/stores/discover";
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
import type { Podcast } from "@/types/podcast";
import { PANE_RATIO } from "@/utils/navigation";

export const DiscoverPaneCount = 3;

function DiscoverPage() {
	const discoverStore = useDiscoverStore();
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const nav = useNavigation();

	const CATS = PaneSlot.PARENT; // 0 — categories (parent)
	const RESULTS = PaneSlot.CURRENT; // 1 — podcast results (landing pane)
	const PREVIEW = PaneSlot.PREVIEW; // 2 — detail + subscribe

	const categories = () => DISCOVER_CATEGORIES;
	const podcasts = () => discoverStore.filteredPodcasts();

	const focusedCategory = createMemo(() => {
		const list = categories();
		if (list.length === 0) return undefined;
		return list[Math.min(nav.focusedIndex(CATS), list.length - 1)];
	});

	// ── keep category + results focus in range ───────────────────────────────
	const ensureFocus = () => {
		const cl = categories();
		if (cl.length > 0 && nav.focusedIndex(CATS) >= cl.length)
			nav.setFocusedIndex(CATS, cl.length - 1);
		const pl = podcasts();
		if (pl.length > 0 && nav.focusedIndex(RESULTS) >= pl.length)
			nav.setFocusedIndex(RESULTS, pl.length - 1);
	};
	onMount(ensureFocus);

	const focusedPodcast = createMemo(() => {
		const list = podcasts();
		if (list.length === 0) return undefined;
		return list[Math.min(nav.focusedIndex(RESULTS), list.length - 1)];
	});

	// Register a resolver so visual-mode range selection grows by podcast id.
	onMount(() => {
		nav.registerResolver(
			`${nav.activeTab()}:${RESULTS}`,
			(i) => podcasts()[i]?.id,
		);
		const unsub = on("nav.action", () => {
			nav.registerResolver(
				`${nav.activeTab()}:${RESULTS}`,
				(i) => podcasts()[i]?.id,
			);
		});
		onCleanup(() => unsub());
	});

	// ── helpers ────────────────────────────────────────────────────────────────
	const formatDate = (d: Date) => format(d, "MMM d, yyyy");
	const handleSubscribe = (podcast: Podcast) => {
		discoverStore.toggleSubscription(podcast.id);
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
			if (p === CATS) {
				const c = focusedCategory();
				if (c) discoverStore.setSelectedCategory(c.id);
				nav.swipe(1, DiscoverPaneCount); // dive to results
				return;
			}
			if (p === RESULTS) {
				const pod = focusedPodcast();
				if (pod) handleSubscribe(pod);
			}
		},
		"toggle-select": (p) => {
			if (p === RESULTS) {
				const pod = focusedPodcast();
				if (pod) nav.toggleSelected(pod.id);
			}
		},
		refresh: () => {
			discoverStore.refresh().catch(() => {});
		},
	};

	function len(pane: PaneId): number {
		if (pane === CATS) return categories().length;
		if (pane === RESULTS) return podcasts().length;
		return 0;
	}
	function step(pane: PaneId, delta: number) {
		nav.move(delta, len(pane));
		if (pane === CATS) {
			const c = focusedCategory();
			if (c) discoverStore.setSelectedCategory(c.id);
		}
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
			{/* ── pane 0 (parent, left): categories ───────────────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.parent} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>Categories</text>
				</box>
				<scrollbox
					height="100%"
					focused={isActive(CATS)}
					border
					borderColor={border(CATS)}
					backgroundColor={theme.background}
				>
					<For each={categories()}>
						{(cat, index) => {
							const selected = () =>
								cat.id === discoverStore.selectedCategory();
							return (
								<box
									flexDirection="row"
									gap={1}
									paddingLeft={1}
									paddingRight={1}
									backgroundColor={
										selected() && !isActive(CATS)
											? theme.border
											: focusBg(index(), CATS)
									}
									onMouseDown={() => {
										nav.setActivePane(CATS);
										nav.setFocusedIndex(CATS, index());
										discoverStore.setSelectedCategory(cat.id);
									}}
								>
									<text fg={focusFg(index(), CATS)}>
										{index() === nav.focusedIndex(CATS) ? "❯" : " "}
									</text>
									<text fg={focusFg(index(), CATS)}>{cat.name}</text>
									<Show when={selected()}>
										<text
											fg={
												index() === nav.focusedIndex(CATS)
													? theme.surface
													: theme.accent
											}
										>
											*
										</text>
									</Show>
								</box>
							);
						}}
					</For>
				</scrollbox>
			</box>

			{/* ── pane 1 (current, center): results ───────────────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.current} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>
						{focusedCategory()?.name ?? "Discover"} · {podcasts().length}
					</text>
				</box>
				<scrollbox
					height="100%"
					focused={isActive(RESULTS)}
					border
					borderColor={border(RESULTS)}
					backgroundColor={theme.background}
				>
					<Show
						when={podcasts().length > 0}
						fallback={
							<box padding={1}>
								<text fg={muted()}>No podcasts found. :refresh</text>
							</box>
						}
					>
						<For each={podcasts()}>
							{(podcast, index) => (
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
										<text fg={focusFg(index(), RESULTS)}>{podcast.title}</text>
										<Show when={podcast.isSubscribed}>
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
									<Show when={podcast.author}>
										<text
											fg={
												index() === nav.focusedIndex(RESULTS)
													? theme.surface
													: muted()
											}
											paddingLeft={2}
										>
											by {podcast.author}
										</text>
									</Show>
								</box>
							)}
						</For>
					</Show>
				</scrollbox>
			</box>

			{/* ── pane 2 (preview, right): detail + subscribe ──────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.preview} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>Preview</text>
				</box>
				<scrollbox
					height="100%"
					focused={isActive(PREVIEW)}
					border
					borderColor={border(PREVIEW)}
					backgroundColor={theme.background}
				>
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
									<text fg={theme.success}>✓ Subscribed</text>
								</Show>
								<Show when={!pod().isSubscribed}>
									<text fg={theme.primary}>[+] Subscribe (enter)</text>
								</Show>
								<box height={1} />
								<text fg={theme.textSecondary}>
									{pod().description?.slice(0, 400) ??
										"No description available."}
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
								<text fg={muted()}>
									Updated: {formatDate(pod().lastUpdated)}
								</text>
								<box height={1} />
								<text fg={muted()}>enter: subscribe h/l: panes r: refresh</text>
							</box>
						)}
					</Show>
				</scrollbox>
			</box>
		</box>
	);
}

export { DiscoverPage };
