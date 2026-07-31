/**
 * SettingsPage — yazi depth-stack settings.
 *
 *   depth 0 — sections list (Sync / Sources / Preferences / Visualizer / ...)
 *   depth 1 — the focused section's items as a navigable list
 *   depth 2 — per-item editor (for editor-kind items) or value adjuster
 *
 * Columns render as yazi's prev | current | preview:
 *   left  = previous depth's list (empty at depth 0)
 *   right = preview/help text for the hovered item in center
 *
 * All movement comes from the Shell router over `nav.action` (j/k move,
 * Enter/l drill, h back). Panels no longer register their own useKeyboard —
 * that was the root cause of the old right-pane key conflicts.
 */

import { For, Show, onMount, onCleanup, createMemo } from "solid-js";
import { useTheme } from "@/context/ThemeContext";
import {
	useNavigation,
	NavMode,
	DEPTH_CENTER_PANE,
	type PaneId,
} from "@/context/NavigationContext";
import { on, off } from "@/utils/event-bus";
import type { KeybindActionName } from "@/context/KeybindContext";
import { PANE_RATIO } from "@/utils/navigation";
import type { SettingItem, SettingsSectionDef } from "./types";
import { usePreferencesItems } from "./PreferencesPanel";
import { useVisualizerItems } from "./VisualizerSettings";
import { useSyncItems, closeSyncEditor } from "./SyncPanel";
import { useSourceItems } from "./SourceManager";

export const SettingsPaneCount = 1;

const SECTIONS: SettingsSectionDef[] = [
	{
		id: 0,
		label: "Sync",
		description: "Import/export subscriptions and sync status.",
	},
	{
		id: 1,
		label: "Sources",
		description: "Podcast search/RSS sources — add, enable, remove.",
	},
	{
		id: 2,
		label: "Preferences",
		description: "Theme, font, playback speed, explicit/auto-download.",
	},
	{
		id: 3,
		label: "Visualizer",
		description: "Audio visualizer: bars, sensitivity, cutoffs.",
	},
	{
		id: 4,
		label: "Account",
		description: "Account login & OAuth (not yet implemented).",
	},
];

/** Resolve the items for a section id at render time. Section 4 (Account) has
 *  no items yet. */
function sectionItems(sectionId: number): SettingItem[] {
	switch (sectionId) {
		case 0:
			return useSyncItems();
		case 1:
			return useSourceItems();
		case 2:
			return usePreferencesItems();
		case 3:
			return useVisualizerItems();
		default:
			return [];
	}
}

export function SettingsPage() {
	const { theme } = useTheme();
	const nav = useNavigation();

	const stack = nav.depthStack;
	const depth = nav.currentDepth;

	// ── depth 0: sections ────────────────────────────────────────────────────
	const focusedSectionIdx = () =>
		Math.min(nav.depthFocus(0), SECTIONS.length - 1);
	const focusedSection = () => SECTIONS[focusedSectionIdx()] ?? SECTIONS[0];

	// ── depth ≥1: section items (resolved from the section id stored in the
	//    depth-0 frame's ctx). The depth-1 frame kind is "settings:<id>". ────
	const sectionForDepth1 = (): SettingsSectionDef | undefined => {
		const f = stack()[1];
		if (!f) return undefined;
		const id = Number(f.ctx ?? "0");
		return SECTIONS[id];
	};
	const items = createMemo<SettingItem[]>(() => {
		const sec = sectionForDepth1();
		if (!sec) return [];
		return sectionItems(sec.id);
	});
	const focusedItemIdx = () =>
		items().length === 0 ? 0 : Math.min(nav.depthFocus(1), items().length - 1);
	const focusedItem = (): SettingItem | undefined => items()[focusedItemIdx()];

	// ── depth 2: the editor item (resolved from depth-1 frame ctx + item id) ─
	const editorItem = (): SettingItem | undefined => {
		const f1 = stack()[1];
		const f2 = stack()[2];
		if (!f1 || !f2) return undefined;
		const secId = Number(f1.ctx ?? "0");
		const list = sectionItems(secId);
		return list.find((it) => it.id === f2.ctx);
	};

	// ── drill / open dispatch ───────────────────────────────────────────────
	function open() {
		const d = depth();
		if (d === 0) {
			// drill into the focused section's items
			const id = focusedSection().id;
			nav.pushDepth({
				kind: `settings:${id}`,
				ctx: String(id),
				focus: 0,
			});
			nav.setActivePane(DEPTH_CENTER_PANE);
			return;
		}
		if (d === 1) {
			const it = focusedItem();
			if (!it) return;
			switch (it.kind) {
				case "toggle":
					it.toggle?.();
					return;
				case "action":
					it.run?.();
					return;
				case "info":
					return;
				case "editor":
				case "number":
				case "select":
					nav.pushDepth({
						kind: `settings:item:${it.id}`,
						ctx: it.id,
						focus: 0,
					});
					nav.setActivePane(DEPTH_CENTER_PANE);
					return;
			}
		}
		if (d === 2) {
			// in an editor: Enter adjusts/cycles a number/select forward, toggles
			const it = editorItem();
			if (!it) return;
			if (it.kind === "number" || it.kind === "select") it.cycle?.(1);
			else if (it.kind === "toggle") it.toggle?.();
			return;
		}
	}

	// ── movement (j/k etc.) routed by the Shell over nav.action ───────────────
	const PAGE_ACTIONS: Partial<Record<KeybindActionName, () => void>> = {
		"move-down": () => step(1),
		"move-up": () => step(-1),
		"jump-down": () => step(5),
		"jump-up": () => step(-5),
		"page-down": () => step(10),
		"page-up": () => step(-10),
		"goto-top": () => nav.gotoIndex(0, len()),
		"goto-bottom": () => nav.gotoIndex(len() - 1, len()),
		open: () => open(),
	};

	function len(): number {
		const d = depth();
		if (d === 0) return SECTIONS.length;
		if (d === 1) return items().length;
		return 0; // depth 2 editor: no list length; j/k cycles instead
	}
	function step(delta: number) {
		const d = depth();
		if (d === 2) {
			// editor: j/k nudges the value
			const it = editorItem();
			if (it?.kind === "number" || it?.kind === "select")
				it.cycle?.(delta as -1 | 1);
			return;
		}
		nav.move(delta, len());
	}

	const onAction = (data: {
		action: KeybindActionName;
		pane: PaneId;
		mode: NavMode;
	}) => {
		// ignore actions meant for non-center panes
		if (data.pane !== DEPTH_CENTER_PANE) return;
		if (nav.activePane() !== DEPTH_CENTER_PANE) return;
		const handler = PAGE_ACTIONS[data.action];
		if (handler) handler();
	};

	onMount(() => {
		on("nav.action", onAction);
		// keep a resolver so visual-mode range selection grows by section/item id
		nav.registerResolver(`${nav.activeTab()}:${DEPTH_CENTER_PANE}`, (i) => {
			const d = depth();
			if (d === 0) return SECTIONS[i]?.id.toString();
			if (d === 1) return items()[i]?.id;
			return undefined;
		});
	});
	onCleanup(() => off("nav.action", onAction));

	// when leaving a sync editor (h to pop), close any open dialog overlay
	onCleanup(() => closeSyncEditor());

	// ── render helpers ───────────────────────────────────────────────────────
	const isActive = nav.activePane() === DEPTH_CENTER_PANE;
	const border = (active: boolean) => (active ? theme.accent : theme.border);
	const headerBg = theme.background;

	// preview text for the right column
	const previewText = createMemo<string>(() => {
		const d = depth();
		if (d === 0) {
			return `${focusedSection().label}\n\n${focusedSection().description}\n\nDrill in (Enter/l) to open this section's settings.`;
		}
		if (d === 1) {
			const it = focusedItem();
			return it?.help() ?? "No item.";
		}
		// editor: same help, plus note
		const it = editorItem();
		return it
			? `${it.help()}\n\n— Editor —\nj/k adjust · h back`
			: "No editor.";
	});

	// ── column content builders ──────────────────────────────────────────────
	// left = previous depth (read-only list), or empty at depth 0
	const LeftCol = () => (
		<box
			flexDirection="column"
			flexGrow={PANE_RATIO.parent}
			flexShrink={1}
			flexBasis={0}
			height="100%"
			style={{ width: depth() === 0 ? 0 : undefined }}
			overflow="hidden"
		>
			<box height={1} paddingLeft={1} backgroundColor={headerBg}>
				<text fg={theme.textSecondary}>
					<Show when={depth() >= 1} fallback=" ">
						{depth() === 1 ? "Sections" : (sectionForDepth1()?.label ?? "")}
					</Show>
				</text>
			</box>
			<Show when={depth() === 1}>
				<scrollbox
					height="100%"
					border
					borderColor={theme.border}
					backgroundColor={theme.background}
				>
					<For each={SECTIONS}>
						{(section, index) => (
							<Row
								label={`${section.id + 1}. ${section.label}`}
								focused={index() === focusedSectionIdx()}
								active={false}
							/>
						)}
					</For>
				</scrollbox>
			</Show>
			<Show when={depth() === 2}>
				<scrollbox
					height="100%"
					border
					borderColor={theme.border}
					backgroundColor={theme.background}
				>
					<For each={items()}>
						{(it, index) => (
							<Row
								label={`${it.label}  ${it.display()}`}
								focused={index() === focusedItemIdx()}
								active={false}
							/>
						)}
					</For>
				</scrollbox>
			</Show>
		</box>
	);

	// center = current depth
	const CenterCol = () => (
		<box
			flexDirection="column"
			flexGrow={PANE_RATIO.current}
			flexShrink={1}
			flexBasis={0}
			height="100%"
		>
			<box height={1} paddingLeft={1} backgroundColor={headerBg}>
				<text fg={theme.textSecondary}>
					<Show
						when={depth() === 0}
						fallback={
							<Show
								when={depth() === 1}
								fallback={editorItem()?.label ?? "Editor"}
							>
								{sectionForDepth1()?.label ?? "Items"}
							</Show>
						}
					>
						Settings
					</Show>
				</text>
			</box>
			<scrollbox
				height="100%"
				focused={isActive}
				border
				borderColor={border(isActive)}
				backgroundColor={theme.background}
			>
				<Show when={depth() === 0}>
					<For each={SECTIONS}>
						{(section, index) => (
							<Row
								label={`${section.id + 1}. ${section.label}`}
								focused={index() === focusedSectionIdx()}
								active={isActive}
								onMouseDown={() => {
									nav.setActivePane(DEPTH_CENTER_PANE);
									nav.setDepthFocus(index(), 0);
								}}
							/>
						)}
					</For>
				</Show>
				<Show when={depth() === 1}>
					<For each={items()}>
						{(it, index) => (
							<Row
								label={`${it.label}`}
								value={it.display()}
								focused={index() === focusedItemIdx()}
								active={isActive}
								hint={hintFor(it)}
								onMouseDown={() => {
									nav.setActivePane(DEPTH_CENTER_PANE);
									nav.setDepthFocus(index(), 1);
								}}
							/>
						)}
					</For>
					<Show when={items().length === 0}>
						<box padding={1}>
							<text fg={theme.muted ?? theme.textMuted}>(No items.)</text>
						</box>
					</Show>
				</Show>
				<Show when={depth() === 2}>
					<Show
						when={editorItem()?.renderEditor}
						fallback={<GenericEditor item={editorItem()!} />}
					>
						{editorItem()!.renderEditor!()}
					</Show>
				</Show>
			</scrollbox>
		</box>
	);

	// right = preview / help
	const RightCol = () => (
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
				<box padding={1}>
					<MultiLine text={previewText()} />
				</box>
			</scrollbox>
		</box>
	);

	return (
		<box flexDirection="row" flexGrow={1} width="100%" height="100%">
			{LeftCol()}
			{CenterCol()}
			{RightCol()}
		</box>
	);
}

/** Per-kind hint glyph shown at the right of an item row. */
function hintFor(it: SettingItem): string {
	switch (it.kind) {
		case "toggle":
			return "⏻";
		case "number":
		case "select":
			return "±";
		case "action":
			return "↵";
		case "editor":
			return "→";
		case "info":
			return "·";
	}
}

function Row(props: {
	label: string;
	value?: string;
	focused: boolean;
	active: boolean;
	hint?: string;
	onMouseDown?: () => void;
}) {
	const { theme } = useTheme();
	const bg = () =>
		props.focused && props.active
			? theme.primary
			: props.focused
				? theme.border
				: undefined;
	const fg = () => (props.focused && props.active ? theme.surface : theme.text);
	return (
		<box
			flexDirection="row"
			gap={1}
			paddingLeft={1}
			paddingRight={1}
			backgroundColor={bg()}
			onMouseDown={props.onMouseDown}
		>
			<text fg={fg()}>{props.focused ? "❯" : " "}</text>
			<text fg={fg()}>{props.label}</text>
			<Show when={props.value}>
				<box flexGrow={1} />
				<text fg={props.focused ? fg() : theme.textMuted}>{props.value}</text>
			</Show>
			<Show when={props.hint}>
				<text fg={theme.textMuted}>{props.hint}</text>
			</Show>
		</box>
	);
}

/** Center editor for number/select/toggle items without a bespoke renderer. */
function GenericEditor(props: { item: SettingItem }) {
	const { theme } = useTheme();
	const it = props.item;
	return (
		<box flexDirection="column" padding={1} gap={1}>
			<text fg={theme.text}>
				<strong>{it.label}</strong>
			</text>
			<box flexDirection="row" gap={1} alignItems="center">
				<text fg={theme.textMuted}>Value:</text>
				<box border borderColor={theme.border} padding={0}>
					<text fg={theme.text}>{it.display()}</text>
				</box>
			</box>
			<Show when={it.kind === "number" || it.kind === "select"}>
				<text fg={theme.muted ?? theme.textMuted}>
					j/k to adjust · Enter to nudge forward · h to go back
				</text>
			</Show>
			<Show when={it.kind === "toggle"}>
				<text fg={theme.muted ?? theme.textMuted}>
					Enter/Space to toggle · h to go back
				</text>
			</Show>
		</box>
	);
}

/** Renders a string with `\n` newlines as stacked <text> lines. */
function MultiLine(props: { text: string }) {
	const lines = () => props.text.split("\n");
	const { theme } = useTheme();
	return (
		<For each={lines()}>
			{(line, i) => (
				<text fg={i() === 0 ? theme.accent : theme.textMuted}>
					{line || " "}
				</text>
			)}
		</For>
	);
}
