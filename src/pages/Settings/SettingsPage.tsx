/**
 * SettingsPage — yazi depth-stack settings.
 *
 *   depth 0 — sections list (Sync / Sources / Preferences / Visualizer / ...)
 *   depth 1 — the focused section's items as a navigable list
 *   depth 2 — per-item editor (for editor-kind items) or value adjuster
 *
 * Renders entirely through `<YaziPaneRow>` (parent | current | preview):
 *   parent  = previous depth's list (sections at depth 1, items at depth 2);
 *             blank placeholder at depth 0 (1/7 slot kept).
 *   current = the current-depth list (or editor at depth 2); the only
 *             focusable column.
 *   preview = help/preview text for the hovered item in current.
 *
 * All movement comes from the Shell router over `nav.action` (j/k move,
 * Enter/l drill, h back). Panels no longer register their own useKeyboard —
 * that was the root cause of the old right-pane key conflicts.
 */

import { For, Show, onMount, onCleanup, createMemo } from "solid-js";
import { rgbToHex, type RGBA } from "@opentui/core";
import { useTheme, type ThemeResolved } from "@/context/ThemeContext";
import {
	useNavigation,
	NavMode,
	DEPTH_CENTER_PANE,
	type PaneId,
} from "@/context/NavigationContext";
import { on, off } from "@/utils/event-bus";
import type { KeybindActionName } from "@/context/KeybindContext";
import type { SettingItem, SettingsSectionDef } from "./types";
import { usePreferencesItems } from "./PreferencesPanel";
import { useVisualizerItems } from "./VisualizerSettings";
import { useSyncItems, closeSyncEditor } from "./SyncPanel";
import { useSourceItems } from "./SourceManager";
import { YaziPaneRow } from "@/components/YaziPaneRow";
import { TabListPane } from "@/components/TabPanel";

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
	const isActive = () => nav.activePane() === DEPTH_CENTER_PANE;

	// Whether the currently-focused settings row is the Theme select — the
	// only item whose Detail pane carries a color breakdown below the help text.
	const isThemeItem = () => {
		const d = depth();
		if (d === 1) return focusedItem()?.id === "theme";
		if (d === 2) return editorItem()?.id === "theme";
		return false;
	};

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

	// ── column label ───────────────────────────────────────────────────────────
	const currentLabel = () => {
		const d = depth();
		if (d === 0) return "Settings";
		if (d === 1) return sectionForDepth1()?.label ?? "Items";
		return editorItem()?.label ?? "Editor";
	};
	const parentLabel = () => {
		const d = depth();
		if (d === 1) return "Sections";
		if (d === 2) return sectionForDepth1()?.label ?? "";
		return "Up";
	};

	// ── parent pane: previous-depth list (blank at depth 0) ────────────────
	// Sibling <Show> blocks per depth (mirrors the preview pane) so Solid
	// mounts every branch once and toggles children on depth change — the
	// known-good opentui disposal pattern. A ternary returning different
	// roots leaves subtree orphaned on swap; the trick is a STABLE fragment
	// root whose inner <Show> children swap instead.
	const parentContent = () => (
		<>
			<Show when={depth() === 0}>
				{/* app root: the tab list as the parent (muted) at the lowest depth */}
				<TabListPane muted />
			</Show>
			<Show when={depth() === 1}>
				{/* previous depth = sections list (read-only) */}
				<For each={SECTIONS}>
					{(section, index) => (
						<Row
							label={section.label}
							focused={index() === focusedSectionIdx()}
							active={false}
						/>
					)}
				</For>
			</Show>
			<Show when={depth() === 2}>
				{/* previous depth = items list (read-only) */}
				<For each={items()}>
					{(it, index) => (
						<Row
							label={`${it.label}  ${it.display()}`}
							focused={index() === focusedItemIdx()}
							active={false}
						/>
					)}
				</For>
			</Show>
		</>
	);

	// ── current pane: current-depth list (or editor at depth 2) ───────────────
	const currentContent = () => (
		<>
			<Show when={depth() === 0}>
				<For each={SECTIONS}>
					{(section, index) => (
						<Row
							label={section.label}
							focused={index() === focusedSectionIdx()}
							active={isActive()}
							onMouseDown={() => {
								nav.setActivePane(DEPTH_CENTER_PANE);
								nav.setDepthFocus(index(), 0);
							}}
						/>
					)}
				</For>
			</Show>
			<Show when={depth() === 1}>
				<box flexDirection="column">
					<For each={items()}>
						{(it, index) => (
							<Row
								label={`${it.label}`}
								value={it.display()}
								focused={index() === focusedItemIdx()}
								active={isActive()}
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
				</box>
			</Show>
			<Show when={depth() === 2}>
				{/* depth 2: editor */}
				<Show
					when={editorItem()?.renderEditor}
					fallback={<GenericEditor item={editorItem()!} />}
				>
					{editorItem()!.renderEditor!()}
				</Show>
			</Show>
		</>
	);

	// ── preview pane ──────────────────────────────────────────────────────────
	const previewContent = () => (
		<box padding={1} flexDirection="column">
			{/* Keep everything on a stable root so Solid re-resolves the swap
			    between plain help text and the theme breakdown on focus move. */}
			<Show when={isThemeItem()} fallback={<MultiLine text={previewText()} />}>
				<MultiLine text={previewText()} />
				<ThemeBreakdown />
			</Show>
		</box>
	);

	return (
		<YaziPaneRow
			parent={parentContent}
			current={currentContent}
			preview={previewContent}
			parentLabel={parentLabel}
			currentLabel={currentLabel}
			previewLabel="Detail"
			focused={isActive}
		/>
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

/** Curated theme color roles shown in the Theme breakdown. */
const THEME_ROLES: Array<{ key: keyof ThemeResolved; label: string }> = [
	{ key: "primary", label: "Primary" },
	{ key: "secondary", label: "Secondary" },
	{ key: "accent", label: "Accent" },
	{ key: "text", label: "Text" },
	{ key: "textMuted", label: "Muted" },
	{ key: "background", label: "Background" },
	{ key: "surface", label: "Surface" },
	{ key: "border", label: "Border" },
	{ key: "error", label: "Error" },
	{ key: "warning", label: "Warning" },
	{ key: "success", label: "Success" },
	{ key: "info", label: "Info" },
];

/** Color swatch breakdown (‹block› <Label> (<HEX>)) of the resolved theme. */
function ThemeBreakdown() {
	const { theme, selected } = useTheme();
	return (
		<box flexDirection="column" paddingTop={1} gap={1}>
			<text fg={theme.accent}>Theme · {selected}</text>
			<For each={THEME_ROLES}>
				{(role) => {
					const color = theme[role.key] as RGBA | undefined;
					return (
						<box flexDirection="row" gap={1} alignItems="center">
							<box backgroundColor={color}>
								<text>{"  "}</text>
							</box>
							<text fg={theme.text}>{role.label}</text>
							<box flexGrow={1} />
							<text fg={theme.textMuted}>
								{color ? rgbToHex(color).toUpperCase() : "n/a"}
							</text>
						</box>
					);
				}}
			</For>
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
