/**
 * PaneRow — the shared parent | current | preview 3-pane layout primitive.
 *
 * Implements yazi's resizable `mgr.ratio` contract: the two borders of the
 * CENTER (current) column are draggable and resize the neighboring panes.
 * Split positions live in the shared pane-layout store (`@/stores/pane-layout`)
 * as fractions of the row width; this component resolves them to pixel
 * columns, gives each column an explicit width (so the drag strips sit
 * exactly on the drawn borders), and renders two invisible grab handles over
 * the border cells.
 *
 * Column semantics (per the yazi depth model):
 *   parent  — the previous-depth list. Renders a muted `—` placeholder and
 *             keeps a minimum 15-col slot. Borderless.
 *   current — the current-depth list. The only focusable content column; the
 *             ONLY bordered column — left/right edges only, always muted.
 *   preview — detail of the hovered item in `current`. Borderless.
 *
 * The primitive is purely structural: callers pass their own JSX per column
 * (static elements or accessors) plus the current-column title. Theme colors
 * are resolved internally via `useTheme()`. Only the current column's
 * `<scrollbox>` receives `focused`, so scroll focus follows the cursor.
 *
 * Example:
 *   <PaneRow
 *     parent={parentList}
 *     current={currentList}
 *     preview={detail}
 *     currentLabel="List · 42"
 *     focused={isActive}
 *   />
 */

import { createMemo, createSignal, Show } from "solid-js";
import type { JSX } from "solid-js";
import { useTerminalDimensions } from "@opentui/solid";
import type { RGBA, BorderSides } from "@opentui/core";
import { useTheme } from "@/context/ThemeContext";
import {
	MIN_PANE_WIDTH,
	splitPixels,
	usePaneLayout,
} from "@/stores/pane-layout";

// ── Types ───────────────────────────────────────────────────────────────────
type PaneContent = JSX.Element | (() => JSX.Element);
type PaneLabel = string | (() => string);

export type PaneRowProps = {
	/** Parent column content (previous-depth list, or null for a muted
	 *  placeholder — a minimum slot is always preserved). */
	parent?: PaneContent;
	/** Current column content (the focused list). */
	current?: PaneContent;
	/** Preview column content (detail of the hovered item). Omit/undefined
	 *  together with `panes={2}` to render a 2-pane parent|current row. */
	preview?: PaneContent;
	/** Title of the current column — rendered once, top-left in the parent
	 *  pane's header slot (the per-pane Up/Detail headers are gone). */
	currentLabel?: PaneLabel;
	/** Whether the current column's `<scrollbox>` receives scroll focus. Defaults to
	 *  true; pass `false` (or a signal) when the row is inactive. Does NOT change
	 *  border colors — the current column's border is always muted. */
	focused?: boolean | (() => boolean);
	/** Number of visible columns. `3` (default) = parent|current|preview;
	 *  `2` = parent|current (preview omitted, current grows to fill). */
	panes?: 2 | 3;
	/** Which sides of the current column's border render. Defaults to
	 *  `["left", "right"]` (the standard focused-list frame). */
	currentBorder?: boolean | BorderSides[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function resolveLabel(v: PaneLabel | undefined): string {
	if (v == null) return "";
	return typeof v === "function" ? v() : v;
}

/** Normalize a PaneContent (static JSX or accessor) into a reactive accessor.
 *  We deliberately avoid Solid's `children()` helper: it flattens accessor
 *  children into a stable resolved-nodes array and won't re-resolve on a
 *  truthy→truthy root swap (e.g. the current pane switching between a
 *  depth-1 list fragment and a depth-2 editor), freezing the previous
 *  subtree. Instead the raw accessor feeds a reactive `{ expr ?? <Placeholder/> }`
 *  expression — a tracked `insert` effect that disposes the old subtree and
 *  mounts the new whenever the accessor returns a different element identity. */
function normalizeContent(
	v: PaneContent | undefined,
): () => JSX.Element | undefined {
	if (v == null) return () => undefined;
	return typeof v === "function" ? (v as () => JSX.Element) : () => v;
}

function Placeholder(props: { color: () => RGBA }) {
	return (
		<box padding={1}>
			<text fg={props.color()}>—</text>
		</box>
	);
}

// ── Pane column ─────────────────────────────────────────────────────────────
function Pane(props: {
	width: number;
	label: () => string;
	content: () => JSX.Element | undefined;
	border: boolean | BorderSides[];
	scrollFocused: () => boolean;
}) {
	const themeContext = useTheme();
	const theme = themeContext.theme;
	const muted = () => theme.muted ?? theme.textMuted ?? theme.text;

	// Memoize the scroll-focus accessor result so the prop expression below
	// stays reactive when the underlying signal (e.g. `focused`) changes.
	const scrollFocused = createMemo(() => props.scrollFocused());

	return (
		<box
			flexDirection="column"
			width={props.width}
			flexShrink={0}
			height="100%"
		>
			{/* ── title row: rendered only when the pane carries a label ────────── */}
			<Show when={props.label() !== ""}>
				<box
					height={1}
					paddingLeft={1}
					backgroundColor={
						themeContext.transparentBackground()
							? "transparent"
							: theme.background
					}
				>
					<text fg={theme.textSecondary}>{props.label()}</text>
				</box>
			</Show>
			{/* ── scrollbox; border always muted (focused or not) ──────────────── */}
			<scrollbox
				height="100%"
				focused={scrollFocused()}
				border={props.border}
				// Only supply colors when a border is requested — opentui flips a
				// borderless box to bordered when borderColor/focusedBorderColor
				// are passed, which would frame the parent/preview panes too.
				borderColor={props.border === false ? undefined : theme.border}
				focusedBorderColor={
					props.border === false ? undefined : theme.border
				}
				backgroundColor={
					themeContext.transparentBackground()
						? "transparent"
						: theme.background
				}
			>
			{props.content() ?? <Placeholder color={muted} />}
			</scrollbox>
		</box>
	);
}

/** A 1-column invisible grab handle covering exactly one border of the
 *  current pane. `onBegin` is called on mousedown; subsequent drag/drag-end
 *  events bubble up the row and drive `usePaneLayout` there. On hover or
 *  while dragging it overdraws the border with a full-height accent `│`
 *  line (a bordered box would render as a blocky rectangle instead). */
function Splitter(props: {
	left: number;
	active: boolean;
	onBegin: () => void;
}) {
	const { theme } = useTheme();
	const dims = useTerminalDimensions();
	const [hovered, setHovered] = createSignal(false);
	const highlighted = () => props.active || hovered();
	return (
		<box
			position="absolute"
			left={props.left}
			top={0}
			width={1}
			height="100%"
			onMouseDown={(e) => {
				e.preventDefault?.();
				props.onBegin();
			}}
			onMouseOver={() => setHovered(true)}
			onMouseOut={() => setHovered(false)}
		>
			<Show when={highlighted()}>
				{/* Draw the accent edge down the full pane height; the box clips
				 * any excess rows below the row's bottom edge. */}
				<text fg={theme.primary} selectable={false}>
					{"│\n".repeat(dims().height)}
				</text>
			</Show>
		</box>
	);
}

// ── Row primitive ───────────────────────────────────────────────────────────
export function PaneRow(props: PaneRowProps) {
	/** true → the current column's scrollbox is focused (scroll follows cursor). */
	const focused = createMemo(() => {
		const f = props.focused;
		return typeof f === "function" ? f() : (f ?? true);
	});

	// Normalize static JSX and accessor children into reactive accessors
	// (see normalizeContent for why we avoid Solid's `children()` helper).
	const parentContent = normalizeContent(props.parent);
	const currentContent = normalizeContent(props.current);
	const previewContent = normalizeContent(props.preview);

	// The single title: the CURRENT column's label, rendered in the parent
	// pane's header slot (top-left). Current/preview panes have no headers.
	const currentLabel = createMemo(() => resolveLabel(props.currentLabel));

	// 2-pane mode (parent|current) grows the current column to fill the
	// preview slot. Defaults to 3 (parent|current|preview).
	const panes = createMemo(() => props.panes ?? 3);
	const currentBorder = createMemo<boolean | BorderSides[]>(
		() => props.currentBorder ?? ["left", "right"],
	);

	// Shared split state + terminal width drive explicit column widths so the
	// drag strips sit exactly on the drawn borders.
	const layout = usePaneLayout();
	const dims = useTerminalDimensions();
	const width = () => dims().width;
	const pixels = createMemo(() => splitPixels(width(), layout.splits()));
	const hasRoom = () =>
		width() >=
		MIN_PANE_WIDTH.parent + MIN_PANE_WIDTH.current + MIN_PANE_WIDTH.preview;

	// Column widths in pixels (sum to the row width).
	const parentWidth = () => pixels().leftPx;
	const currentWidth = () =>
		panes() === 2
			? width() - pixels().leftPx
			: pixels().rightPx - pixels().leftPx;
	const previewWidth = () => width() - pixels().rightPx;

	// ── Drag state ──────────────────────────────────────────────────────────
	// onMouseDown on a Splitter records which border is being dragged; the
	// row then lives-updates the split from the absolute drag x (bubbled up
	// from whatever renderable the cursor captures) and commits on release.
	const [activeSplit, setActiveSplit] = createSignal<"left" | "right" | null>(
		null,
	);
	const beginDrag = (which: "left" | "right") => () => setActiveSplit(which);
	const handleDrag = (e: { x: number }) => {
		const which = activeSplit();
		if (!which) return;
		if (which === "left") layout.setLeft(e.x, width());
		else layout.setRight(e.x, width());
	};
	const handleDragEnd = () => {
		if (activeSplit()) layout.commit();
		setActiveSplit(null);
	};

	return (
		<box
			flexDirection="row"
			width="100%"
			height="100%"
			flexGrow={1}
			onMouseDrag={handleDrag}
			onMouseDragEnd={handleDragEnd}
			onMouseUp={handleDragEnd}
		>
			{/* ── parent — previous-depth list; title row top-left ─────────────── */}
			<Pane
				width={parentWidth()}
				label={currentLabel}
				content={parentContent}
				border={false}
				scrollFocused={() => false}
			/>
			{/* ── current — the focused list; left/right borders only ─────────── */}
			<Pane
				width={currentWidth()}
				label={() => ""}
				content={currentContent}
				border={currentBorder()}
				scrollFocused={() => focused()}
			/>
			{/* ── preview (optional) — hovered-item detail; no border ─────────── */}
			<Show when={panes() === 3}>
				<Pane
					width={previewWidth()}
					label={() => ""}
					content={previewContent}
					border={false}
					scrollFocused={() => false}
				/>
			</Show>
			{/* ── drag handles over the current pane's borders ───────────────── */}
					<Show when={hasRoom()}>
			<Splitter
				left={pixels().leftPx}
				active={activeSplit() === "left"}
				onBegin={beginDrag("left")}
			/>
			<Show when={panes() === 3}>
				<Splitter
					left={pixels().rightPx - 1}
					active={activeSplit() === "right"}
					onBegin={beginDrag("right")}
				/>
			</Show>
		</Show>
		</box>
	);
}
