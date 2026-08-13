/**
 * Shared list-row and preview components for the Feed and My Shows pages.
 *
 * Both pages render the same episode rows (marker + title, optional subtitle
 * line, date/duration/selection/download meta line), "[Fetch More]" rows, and
 * hovered-episode / fetch-more preview panes; the pages differ only in the
 * props they pass (subtitle line, hint text, manual-mode wording). Extracted
 * so the previously 3-4-level-nested render blocks run as flat named
 * components.
 *
 * Anything that can change at runtime arrives as a signal getter: Solid
 * components do not re-render, so only props that are called inside the
 * component's own JSX stay reactive (focus, selection, download state).
 */

import { Show } from "solid-js";
import { format } from "date-fns";
import type { RGBA } from "@opentui/core";
import { useTheme } from "@/context/ThemeContext";
import { useScrollIntoView } from "@/hooks/useScrollIntoView";
import { NF_ICONS } from "@/utils/nerd-fonts";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import type { Episode } from "@/types/episode";

// ── formatting helpers ──────────────────────────────────────────────────────
export const formatDate = (d: Date) => format(d, "MMM d, yyyy");

export const formatDuration = (s: number) => {
	const mins = Math.floor(s / 60);
	const hrs = Math.floor(mins / 60);
	return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
};

// ── EpisodeRow ──────────────────────────────────────────────────────────────
export function EpisodeRow(props: {
	/** The episode this row renders. */
	episode: Episode;
	/** Optional second line under the title (podcast/show name). */
	subtitle?: () => string | undefined;
	/** For index signal (row position). */
	index: () => number;
	/** Focused row index in this list (-1 while the Fetch More row is
	 *  focused, so no episode row draws the cursor). */
	focused: () => number;
	/** Whether the current pane has keyboard focus. */
	active: () => boolean;
	/** Whether this episode is selection-marked. */
	selected: () => boolean;
	downloadLabel: () => string;
	downloadColor: () => RGBA;
	marker: () => string;
	onMouseDown: () => void;
}) {
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	const ref = useScrollIntoView(() => props.index() === props.focused());
	const isFocused = () => props.index() === props.focused();
	const bg = () =>
		isFocused() && props.active()
			? theme.primary
			: isFocused()
				? theme.border
				: undefined;
	const fg = () =>
		isFocused() && props.active()
			? theme.surface
			: isFocused()
				? theme.selectedListItemText ?? theme.text
				: theme.text;
	return (
		<box
			ref={ref}
			flexDirection="column"
			gap={0}
			paddingRight={1}
			backgroundColor={bg()}
			onMouseDown={props.onMouseDown}
		>
			<box flexDirection="row" gap={1}>
				<text flexShrink={0} fg={fg()}>
					{isFocused() ? props.marker() : " "}
				</text>
				<text wrapMode="none" truncate fg={fg()}>
					{props.episode.episodeNumber ? `#${props.episode.episodeNumber} ` : ""}
					{props.episode.title}
				</text>
			</box>
			{/* podcast name on its own row — readable at a glance; the 50%
			    current pane fits it in full for typical names, and truncate
			    keeps the row one line tall either way */}
			<Show when={props.subtitle?.()}>
				<box paddingLeft={2}>
					<text
						wrapMode="none"
						truncate
						fg={isFocused() ? theme.surface : theme.textSecondary}
					>
						{props.subtitle?.()}
					</text>
				</box>
			</Show>
			<box flexDirection="row" gap={2} paddingLeft={2}>
				<text flexShrink={0} fg={isFocused() ? theme.surface : theme.info}>
					{formatDate(props.episode.pubDate)}
				</text>
				<text flexShrink={0} fg={isFocused() ? theme.surface : muted()}>
					{formatDuration(props.episode.duration)}
				</text>
				<Show when={props.selected()}>
					<text flexShrink={0} fg={theme.warning}>
						●
					</text>
				</Show>
				<Show when={props.downloadLabel()}>
					<text flexShrink={0} fg={props.downloadColor()}>
						{props.downloadLabel()}
					</text>
				</Show>
			</box>
		</box>
	);
}

// ── FetchMoreRow ────────────────────────────────────────────────────────────
export function FetchMoreRow(props: {
	/** Row index of the Fetch More button within the list. */
	index: () => number;
	/** Focused row index. */
	focused: () => number;
	/** True while the Fetch More row itself is focused. */
	onMore: () => boolean;
	/** Whether the current pane has keyboard focus. */
	active: () => boolean;
	isLoadingMore: () => boolean;
	nerd: boolean;
	marker: () => string;
	onMouseDown: () => void;
}) {
	const { theme } = useTheme();
	const ref = useScrollIntoView(props.onMore);
	const bg = () =>
		props.index() === props.focused() && props.active()
			? theme.primary
			: props.index() === props.focused()
				? theme.border
				: undefined;
	const fg = () =>
		props.index() === props.focused() && props.active()
			? theme.surface
			: props.index() === props.focused()
				? theme.selectedListItemText ?? theme.text
				: theme.text;
	return (
		<box
			ref={ref}
			flexDirection="row"
			gap={1}
			paddingRight={1}
			backgroundColor={bg()}
			onMouseDown={props.onMouseDown}
		>
			<text fg={fg()}>{props.onMore() ? props.marker() : " "}</text>
			{props.nerd && (
				<text fg={fg()}>{NF_ICONS.more}</text>
			)}
			<Show
				when={!props.isLoadingMore()}
				fallback={<LoadingIndicator label="Fetching…" />}
			>
				<text fg={fg()}>[Fetch More]</text>
			</Show>
		</box>
	);
}

// ── EpisodePreview ──────────────────────────────────────────────────────────
export function EpisodePreview(props: {
	episode: () => Episode;
	/** Optional line under the meta row (podcast/show name). */
	subtitle?: () => string | undefined;
	author: () => string | undefined;
	downloadLabel: () => string;
	downloadColor: () => RGBA;
	/** Page-specific action-hint line. */
	hint: () => string;
}) {
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	return (
		<box flexDirection="column" gap={1} padding={1}>
			<text fg={theme.textPrimary ?? theme.text}>
				<strong>
					{props.episode().episodeNumber ? `#${props.episode().episodeNumber} ` : ""}
					{props.episode().title}
				</strong>
			</text>
			<box flexDirection="row" gap={2}>
				<text fg={theme.info}>{formatDate(props.episode().pubDate)}</text>
				<text fg={muted()}>{formatDuration(props.episode().duration)}</text>
				<Show when={props.downloadLabel()}>
					<text fg={props.downloadColor()}>{props.downloadLabel()}</text>
				</Show>
			</box>
			<Show when={props.subtitle?.()}>
				<text fg={muted()}>{props.subtitle?.()}</text>
			</Show>
			<Show when={props.author()}>
				<text fg={muted()}>by {props.author()}</text>
			</Show>
			<box height={1} />
			<text fg={theme.textSecondary}>
				{props.episode().description?.slice(0, 400) ?? "No description available."}
				{(props.episode().description?.length ?? 0) > 400 ? "…" : ""}
			</text>
			<box height={1} />
			<text fg={muted()}>{props.hint()}</text>
		</box>
	);
}

// ── FetchMorePreview ────────────────────────────────────────────────────────
export function FetchMorePreview(props: {
	isLoadingMore: () => boolean;
	fetchMoreMode: () => string;
	/** Manual-mode explanation line ("across all feeds" vs "for this show"). */
	manualText: () => string;
}) {
	const { theme } = useTheme();
	const muted = () => theme.muted || theme.text;
	return (
		<box flexDirection="column" gap={1} padding={1}>
			<text fg={theme.textPrimary ?? theme.text}>
				<strong>[Fetch More]</strong>
			</text>
			<text fg={muted()}>
				{props.isLoadingMore()
					? "Loading the next batch of episodes…"
					: props.fetchMoreMode() === "auto"
						? "Auto mode: the next batch loads automatically at the bottom of the list."
						: props.manualText()}
			</text>
			<box height={1} />
			<text fg={muted()}>enter: load more · h back</text>
		</box>
	);
}
