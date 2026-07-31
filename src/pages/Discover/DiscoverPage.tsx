/**
 * DiscoverPage — yazi depth-stack view of discoverable podcasts.
 *
 *   depth 0 (current) — category list. Left pane empty at root.
 *   depth 1 (current) — podcast results for the drilled category.
 *   right (preview)   — detail of the hovered item (category summary, or
 *                       podcast detail + subscribe action).
 *
 * `l`/Enter drills in (category → results) or subscribes (on a podcast);
 * `h` pops back (or yields to the sidebar at depth 0). j/k move within the
 * current column. Moving through categories at depth 0 updates the store's
 * selected category so the preview follows.
 */

import { createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { useDiscoverStore, DISCOVER_CATEGORIES } from "@/stores/discover";
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
import { PANE_RATIO } from "@/utils/navigation";

export const DiscoverPaneCount = 1;

function DiscoverPage() {
	const discoverStore = useDiscoverStore();
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const nav = useNavigation();

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

	const curLen = () =>
		depth() === 0 ? categories().length : podcasts().length;

	const ensureFocus = () => {
		if (categories().length > 0 && focus(0) >= categories().length)
			nav.setDepthFocus(categories().length - 1, 0);
		if (podcasts().length > 0 && focus(1) >= podcasts().length)
			nav.setDepthFocus(podcasts().length - 1, 1);
	};
	onMount(ensureFocus);

	onMount(() => {
		nav.registerResolver(`${nav.activeTab()}:${DEPTH_CENTER_PANE}`, (i) => {
			if (depth() === 0) return categories()[i]?.id;
			return podcasts()[i]?.id;
		});
	});

	// ── helpers ────────────────────────────────────────────────────────────────
	const formatDate = (d: Date) => format(d, "MMM d, yyyy");

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
		if (depth() >= 1) {
			const pod = focusedPodcast();
			if (pod) discoverStore.toggleSubscription(pod.id);
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
				const pod = focusedPodcast();
				if (pod) nav.toggleSelected(pod.id);
			}
		},
		refresh: () => {
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
	const isActive = nav.activePane() === DEPTH_CENTER_PANE;
	const border = (active: boolean) => (active ? theme.accent : theme.border);
	const focusBg = (i: number, lf: number, active: boolean) =>
		i === lf && active ? theme.primary : i === lf ? theme.border : undefined;
	const focusFg = (i: number, lf: number, active: boolean) =>
		i === lf && active ? theme.surface : theme.text;
	const headerBg = theme.background;

	return (
		<box flexDirection="row" flexGrow={1} width="100%" height="100%">
			{/* ── left: previous depth (empty at root) ──────────────────────────── */}
			<box
				flexDirection="column"
				flexGrow={PANE_RATIO.parent}
				flexShrink={1}
				flexBasis={0}
				height="100%"
				style={{ width: depth() === 0 ? 0 : undefined }}
				overflow="hidden"
			>
				<Show when={depth() >= 1}>
					<box height={1} paddingLeft={1} backgroundColor={headerBg}>
						<text fg={theme.textSecondary}>Categories</text>
					</box>
					<scrollbox
						height="100%"
						border
						borderColor={theme.border}
						backgroundColor={theme.background}
					>
						<For each={categories()}>
							{(cat, index) => (
								<box
									flexDirection="row"
									gap={1}
									paddingLeft={1}
									paddingRight={1}
									backgroundColor={focusBg(index(), nav.depthFocus(0), false)}
								>
									<text fg={focusFg(index(), nav.depthFocus(0), false)}>
										{index() === nav.depthFocus(0) ? "❯" : " "}
									</text>
									<text fg={focusFg(index(), nav.depthFocus(0), false)}>
										{cat.name}
									</text>
								</box>
							)}
						</For>
					</scrollbox>
				</Show>
			</box>

			{/* ── center: current depth ─────────────────────────────────────────── */}
			<box
				flexDirection="column"
				flexGrow={PANE_RATIO.current}
				flexShrink={1}
				flexBasis={0}
				height="100%"
			>
				<box height={1} paddingLeft={1} backgroundColor={headerBg}>
					<text fg={theme.textSecondary}>
						{depth() === 0
							? "Categories"
							: `${focusedCategory()?.name ?? "Discover"} · ${podcasts().length}`}
					</text>
				</box>
				<scrollbox
					height="100%"
					focused={isActive}
					border
					borderColor={border(isActive)}
					backgroundColor={theme.background}
				>
					{/* depth 0: categories */}
					<Show when={depth() === 0}>
						<For each={categories()}>
							{(cat, index) => {
								const lf = focusedCatIdx();
								const selected = () =>
									cat.id === discoverStore.selectedCategory();
								return (
									<box
										flexDirection="row"
										gap={1}
										paddingLeft={1}
										paddingRight={1}
										backgroundColor={focusBg(index(), lf, isActive)}
										onMouseDown={() => {
											nav.setActivePane(DEPTH_CENTER_PANE);
											nav.setDepthFocus(index(), 0);
											discoverStore.setSelectedCategory(cat.id);
										}}
									>
										<text fg={focusFg(index(), lf, isActive)}>
											{index() === lf ? "❯" : " "}
										</text>
										<text fg={focusFg(index(), lf, isActive)}>{cat.name}</text>
										<Show when={selected()}>
											<text fg={index() === lf ? theme.surface : theme.accent}>
												*
											</text>
										</Show>
									</box>
								);
							}}
						</For>
					</Show>

					{/* depth ≥1: results */}
					<Show when={depth() >= 1}>
						<Show
							when={podcasts().length > 0}
							fallback={
								<box padding={1}>
									<text fg={muted()}>No podcasts found. :refresh</text>
								</box>
							}
						>
							<For each={podcasts()}>
								{(podcast, index) => {
									const lf = focusedPodIdx();
									return (
										<box
											flexDirection="column"
											gap={0}
											paddingLeft={1}
											paddingRight={1}
											backgroundColor={focusBg(index(), lf, isActive)}
											onMouseDown={() => {
												nav.setActivePane(DEPTH_CENTER_PANE);
												nav.setDepthFocus(index(), 1);
											}}
										>
											<box flexDirection="row" gap={1}>
												<text fg={focusFg(index(), lf, isActive)}>
													{index() === lf ? "❯" : " "}
												</text>
												<text fg={focusFg(index(), lf, isActive)}>
													{podcast.title}
												</text>
												<Show when={podcast.isSubscribed}>
													<text
														fg={index() === lf ? theme.surface : theme.success}
													>
														[+]
													</text>
												</Show>
											</box>
											<Show when={podcast.author}>
												<text
													fg={index() === lf ? theme.surface : muted()}
													paddingLeft={2}
												>
													by {podcast.author}
												</text>
											</Show>
										</box>
									);
								}}
							</For>
						</Show>
					</Show>
				</scrollbox>
			</box>

			{/* ── right: preview ────────────────────────────────────────────────── */}
			<box
				flexDirection="column"
				flexGrow={PANE_RATIO.preview}
				flexShrink={1}
				flexBasis={0}
				height="100%"
			>
				<box height={1} paddingLeft={1} backgroundColor={headerBg}>
					<text fg={theme.textSecondary}>Preview</text>
				</box>
				<scrollbox
					height="100%"
					border
					borderColor={theme.border}
					backgroundColor={theme.background}
				>
					{/* depth 0 preview: hovered category */}
					<Show when={depth() === 0}>
						<Show
							when={focusedCategory()}
							fallback={
								<box padding={1}>
									<text fg={muted()}>No category focused</text>
								</box>
							}
						>
							{(cat) => (
								<box flexDirection="column" gap={1} padding={1}>
									<text fg={theme.textPrimary ?? theme.text}>
										<strong>{cat().name}</strong>
									</text>
									<text fg={theme.textSecondary}>
										{(cat() as any).description ??
											`Browse top podcasts in ${cat().name}.`}
									</text>
									<box height={1} />
									<text fg={muted()}>enter/l: open · h: back</text>
								</box>
							)}
						</Show>
					</Show>

					{/* depth ≥1 preview: hovered podcast + subscribe */}
					<Show when={depth() >= 1}>
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
									<text fg={muted()}>
										enter: subscribe · h: back · r: refresh
									</text>
								</box>
							)}
						</Show>
					</Show>
				</scrollbox>
			</box>
		</box>
	);
}

export { DiscoverPage };
