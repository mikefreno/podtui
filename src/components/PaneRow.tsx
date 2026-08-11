/**
 * PaneRow — the shared parent | current | preview 3-pane layout primitive.
 *
 * Implements yazi's `mgr.ratio` contract: three columns grow at
 * 20% : 50% : 30% (PANE_RATIO 2:5:3) of the row width via Yoga `flexGrow`,
 * so every list tab renders an identical, layout-stable shell. Columns use
 * `flexBasis={0}` so the ratio is exact regardless of content width — a
 * column's content can never stretch its slot.
 *
 * Column semantics (per the yazi depth model):
 *   parent  — the previous-depth list. Renders a muted `—` placeholder and
 *             KEEPS its 20% slot when blank (never collapses to width 0).
 *             Borderless (no left/right/top/bottom edge). Carries the single
 *             header row: the CURRENT column's title renders top-left in the
 *             parent's slot (the panes above current/preview were removed).
 *   current — the current-depth list. The only focusable content column; it
 *             is the ONLY bordered column — left/right edges only, always
 *             muted (no active-border highlight, focused or not).
 *   preview — detail of the hovered item in `current`. Borderless, no header.
 *
 * The primitive is purely structural: callers pass their own JSX per column
 * (static elements or accessors) plus the current-column title. Theme colors
 * are resolved internally via `useTheme()`. Only the current column's
 * `<scrollbox>` receives `focused`, so scroll focus follows the cursor (j/k
 * stay in the current pane).
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

import { createMemo, Show } from "solid-js";
import type { JSX } from "solid-js";
import type { RGBA, BorderSides } from "@opentui/core";
import { useTheme } from "@/context/ThemeContext";
import { PANE_RATIO } from "@/utils/navigation";

// ── Types ───────────────────────────────────────────────────────────────────
type PaneContent = JSX.Element | (() => JSX.Element);
type PaneLabel = string | (() => string);

export type PaneRowProps = {
	/** Parent column content (previous-depth list, or null for a muted
	 *  placeholder — the 1/5 slot is always preserved). */
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
	grow: number;
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
			flexGrow={props.grow}
			flexBasis={0}
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
	const currentGrow = createMemo(() =>
		panes() === 2
			? PANE_RATIO.current + PANE_RATIO.preview
			: PANE_RATIO.current,
	);

	return (
		<box flexDirection="row" flexGrow={1} width="100%" height="100%">
			{/* ── parent (20%) — previous-depth list; title row top-left ────────── */}
			<Pane
				grow={PANE_RATIO.parent}
				label={currentLabel}
				content={parentContent}
				border={false}
				scrollFocused={() => false}
			/>
			{/* ── current — the focused list; left/right borders only ─────────── */}
			<Pane
				grow={currentGrow()}
				label={() => ""}
				content={currentContent}
				border={["left", "right"]}
				scrollFocused={() => focused()}
			/>
			{/* ── preview (30%) — hovered-item detail; no border, no header ────── */}
			<Show when={panes() === 3}>
				<Pane
					grow={PANE_RATIO.preview}
					label={() => ""}
					content={previewContent}
					border={false}
					scrollFocused={() => false}
				/>
			</Show>
		</box>
	);
}
