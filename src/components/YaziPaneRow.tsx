/**
 * YaziPaneRow — the shared parent | current | preview 3-pane layout primitive.
 *
 * Implements yazi's `mgr.ratio = [1, 3, 3]` contract: three bordered columns
 * grow at 1/7 : 3/7 : 3/7 of the row width via Yoga `flexGrow`, so every list
 * tab renders an identical, layout-stable shell. Columns use `flexBasis={0}`
 * so the ratio is exact regardless of content width — a column's content can
 * never stretch its slot.
 *
 * Column semantics (per the yazi depth model):
 *   parent  — the previous-depth list. Renders a muted `—` placeholder and
 *             KEEPS its 1/7 slot when blank (never collapses to width 0).
 *   current — the current-depth list. The only focusable content column; it
 *             carries the accent focus ring when `focused` is truthy.
 *   preview — detail of the hovered item in `current`; always muted border.
 *
 * The primitive is purely structural: callers pass their own JSX per column
 * (static elements or accessors) plus header labels. Theme colors are resolved
 * internally via `useTheme()`. Only the current column's `<scrollbox>` receives
 * `focused`, so scroll focus follows the cursor (j/k stay in the current pane).
 *
 * Example:
 *   <YaziPaneRow
 *     parent={parentList}
 *     current={currentList}
 *     preview={detail}
 *     parentLabel="Up"
 *     currentLabel="List · 42"
 *     previewLabel="Detail"
 *     focused={isActive}
 *   />
 */

import { createMemo } from "solid-js";
import type { JSX } from "solid-js";
import type { RGBA } from "@opentui/core";
import { useTheme } from "@/context/ThemeContext";
import { PANE_RATIO } from "@/utils/navigation";

// ── Types ───────────────────────────────────────────────────────────────────
type PaneContent = JSX.Element | (() => JSX.Element);
type PaneLabel = string | (() => string);

export type YaziPaneRowProps = {
	/** Parent column content (previous-depth list, or null for a muted
	 *  placeholder — the 1/7 slot is always preserved). */
	parent?: PaneContent;
	/** Current column content (the focused list). */
	current?: PaneContent;
	/** Preview column content (detail of the hovered item). */
	preview?: PaneContent;
	parentLabel?: PaneLabel;
	currentLabel?: PaneLabel;
	previewLabel?: PaneLabel;
	/** Whether the current column carries the accent focus ring. Defaults to
	 *  true; pass `false` (or a signal) when the row is inactive. Parent and
	 *  preview columns always render muted borders. */
	focused?: boolean | (() => boolean);
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function resolveLabel(v: PaneLabel | undefined): string {
	if (v == null) return "";
	return typeof v === "function" ? v() : v;
}

/** Normalize a PaneContent (static JSX or accessor) into a reactive accessor.
 *  We deliberately do NOT use Solid's `children()` helper here: that helper
 *  flattens accessor children into a stable resolved-nodes array and is the
 *  wrong tool for content whose ROOT swaps at runtime (e.g. the current pane
 *  switching between a depth-1 list fragment and a depth-2 editor — both
 *  truthy JSX roots). `children()` would not re-resolve on a truthy<@->truthy
 *  root swap, freezing the previous subtree in place. Instead we hand the
 *  raw accessor to a reactive `{ expr ?? <Placeholder/> }` expression below,
 *  which Solid compiles into a tracked `insert` effect that disposes the old
 *  subtree and mounts the new whenever the accessor returns a different
 *  element identity. */
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
function YaziPane(props: {
	grow: number;
	label: () => string;
	content: () => JSX.Element | undefined;
	borderColor: () => RGBA;
	scrollFocused: () => boolean;
}) {
	const { theme } = useTheme();
	const muted = () => theme.muted ?? theme.textMuted ?? theme.text;

	// Memoize accessor results so the prop expressions below stay reactive
	// when the underlying signals (e.g. `focused`) change.
	const borderColor = createMemo(() => props.borderColor());
	const scrollFocused = createMemo(() => props.scrollFocused());

	return (
		<box flexDirection="column" flexGrow={props.grow} flexBasis={0} height="100%">
			{/* ── slim header label row ─────────────────────────────────────────── */}
			<box height={1} paddingLeft={1} backgroundColor={theme.background}>
				<text fg={theme.textSecondary}>{props.label()}</text>
			</box>
			{/* ── bordered scrollbox ────────────────────────────────────────────── */}
			<scrollbox
				height="100%"
				focused={scrollFocused()}
				border
				borderColor={borderColor()}
				backgroundColor={theme.background}
			>
				{/*
				 * Render the content accessor directly via a reactive expression.
				 * `{ accessor() ?? <Placeholder/> }` compiles to a Solid `insert`
				 * effect that re-runs whenever the accessor's tracked signals
				 * change (e.g. `depth()` swapping the root from a list fragment to
				 * an editor). Solid disposes the previously-rendered subtree and
				 * mounts the new element identity. `null`/`undefined` falls back
				 * to the muted placeholder so the parent pane keeps its 1/7 slot
				 * visibly blank at depth 0. This is the correct tool for root
				 * swapping — unlike Solid's `children()` / `<Show>`-children,
				 * which only react to truthiness flips, not truthy<@->truthy root
				 * identity changes.
				 */}
				{props.content() ?? <Placeholder color={muted} />}
			</scrollbox>
		</box>
	);
}

// ── Row primitive ───────────────────────────────────────────────────────────
export function YaziPaneRow(props: YaziPaneRowProps) {
	const { theme } = useTheme();

	/** true → the current column gets the accent focus ring. */
	const focused = createMemo(() => {
		const f = props.focused;
		return typeof f === "function" ? f() : f ?? true;
	});

	// Normalize static JSX and accessor children into reactive accessors
	// (see normalizeContent for why we avoid Solid's `children()` helper).
	const parentContent = normalizeContent(props.parent);
	const currentContent = normalizeContent(props.current);
	const previewContent = normalizeContent(props.preview);

	const parentLabel = createMemo(() => resolveLabel(props.parentLabel));
	const currentLabel = createMemo(() => resolveLabel(props.currentLabel));
	const previewLabel = createMemo(() => resolveLabel(props.previewLabel));

	return (
		<box flexDirection="row" flexGrow={1} width="100%" height="100%">
			{/* ── parent (1/7) — previous-depth list; always muted ─────────────── */}
			<YaziPane
				grow={PANE_RATIO.parent}
				label={parentLabel}
				content={parentContent}
				borderColor={() => theme.border}
				scrollFocused={() => false}
			/>
			{/* ── current (3/7) — the focused list; accent ring when focused ───── */}
			<YaziPane
				grow={PANE_RATIO.current}
				label={currentLabel}
				content={currentContent}
				borderColor={() => (focused() ? theme.accent : theme.border)}
				scrollFocused={() => focused()}
			/>
			{/* ── preview (3/7) — hovered-item detail; always muted ────────────── */}
			<YaziPane
				grow={PANE_RATIO.preview}
				label={previewLabel}
				content={previewContent}
				borderColor={() => theme.border}
				scrollFocused={() => false}
			/>
		</box>
	);
}
