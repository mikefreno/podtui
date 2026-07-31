/**
 * SettingsPage — yazi-style 2-pane view.
 *
 *   pane 0 (parent)  — section list (Sync, Sources, Preferences, ...)
 *   pane 1 (current) — active panel for the focused section
 *
 * Movement (j/k, gg/G, page-jumps) on pane 0 navigates the section list.
 * The panel (pane 1) reactively shows the focused section's content.
 * Audio transport and tab/pane swipes are handled by the Shell router.
 */

import { For, Show, onMount, onCleanup } from "solid-js";
import { SourceManager } from "./SourceManager";
import { PreferencesPanel } from "./PreferencesPanel";
import { SyncPanel } from "./SyncPanel";
import { VisualizerSettings } from "./VisualizerSettings";
import { useTheme } from "@/context/ThemeContext";
import {
	useNavigation,
	NavMode,
	PaneSlot,
	type PaneId,
} from "@/context/NavigationContext";
import { on, off } from "@/utils/event-bus";
import type { KeybindActionName } from "@/context/KeybindContext";
import { PANE_RATIO } from "@/utils/navigation";

export const SettingsPaneCount = 2;

const SECTIONS = [
	{ id: 0, label: "Sync" },
	{ id: 1, label: "Sources" },
	{ id: 2, label: "Preferences" },
	{ id: 3, label: "Visualizer" },
	{ id: 4, label: "Account" },
] as const;

export function SettingsPage() {
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const nav = useNavigation();

	const SECTIONS_PANE = PaneSlot.PARENT; // 0
	const PANEL = PaneSlot.CURRENT; // 1

	// The focused section tracks pane 0's focused index.
	const focusedSection = () => {
		const idx = nav.focusedIndex(SECTIONS_PANE);
		return SECTIONS[Math.min(idx, SECTIONS.length - 1)] ?? SECTIONS[0];
	};

	// Register a resolver so visual-mode range selection grows by section id.
	onMount(() => {
		nav.registerResolver(`${nav.activeTab()}:${SECTIONS_PANE}`, (i) =>
			SECTIONS[Math.min(i, SECTIONS.length - 1)]?.id.toString(),
		);
	});

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
			if (p === SECTIONS_PANE) {
				nav.swipe(1, SettingsPaneCount);
			}
		},
	};

	function len(pane: PaneId): number {
		if (pane === SECTIONS_PANE) return SECTIONS.length;
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
			{/* ── pane 0: sections ─────────────────────────────────────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.parent} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>Settings</text>
				</box>
				<scrollbox
					height="100%"
					focused={isActive(SECTIONS_PANE)}
					border
					borderColor={border(SECTIONS_PANE)}
					backgroundColor={theme.background}
				>
					<For each={SECTIONS}>
						{(section, index) => (
							<box
								flexDirection="row"
								gap={1}
								paddingLeft={1}
								paddingRight={1}
								backgroundColor={focusBg(index(), SECTIONS_PANE)}
								onMouseDown={() => {
									nav.setActivePane(SECTIONS_PANE);
									nav.setFocusedIndex(SECTIONS_PANE, index());
								}}
							>
								<text fg={focusFg(index(), SECTIONS_PANE)}>
									{index() === nav.focusedIndex(SECTIONS_PANE) ? "❯" : " "}
								</text>
								<text fg={focusFg(index(), SECTIONS_PANE)}>
									{section.label}
								</text>
							</box>
						)}
					</For>
				</scrollbox>
			</box>

			{/* ── pane 1: panel ─────────────────────────────────────────────────────── */}
			<box flexDirection="column" flexGrow={PANE_RATIO.current} height="100%">
				<box height={1} paddingLeft={1} backgroundColor={theme.background}>
					<text fg={theme.textSecondary}>{focusedSection().label}</text>
				</box>
				<scrollbox
					height="100%"
					focused={isActive(PANEL)}
					border
					borderColor={border(PANEL)}
					backgroundColor={theme.background}
				>
					<Show when={focusedSection().id === 0}>
						<SyncPanel />
					</Show>
					<Show when={focusedSection().id === 1}>
						<SourceManager focused />
					</Show>
					<Show when={focusedSection().id === 2}>
						<PreferencesPanel />
					</Show>
					<Show when={focusedSection().id === 3}>
						<VisualizerSettings />
					</Show>
					<Show when={focusedSection().id === 4}>
						<box padding={1} flexDirection="column" gap={1}>
							<text fg={muted()}>Account settings (not yet implemented)</text>
						</box>
					</Show>
				</scrollbox>
			</box>
		</box>
	);
}
