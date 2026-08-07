/**
 * TabListPane — the tab list as a pane you can drop into the UP | CURRENT |
 * PREVIEW flow (replaces the old fixed chrome tab column).
 *
 * Renders one row per tab (digit + label): the ACTIVE tab gets a ● marker and
 * accent fg; the CURSOR row (the one j/k hovers) gets the primary highlight.
 * `focused` only matters to the surrounding frame (the CURRENT column draws
 * its own accent ring in YaziPaneRow); when rendered as the muted UP/parent
 * column (`muted`), the cursor highlight is suppressed and only the active ●
 * shows, so it reads as the read-only parent listing.
 */

import { For } from "solid-js";
import { useTheme } from "@/context/ThemeContext";
import { useNavigation } from "@/context/NavigationContext";
import { TABS } from "@/utils/navigation";

const TAB_LABEL: Record<TABS, string> = {
	[TABS.FEED]: "Feed",
	[TABS.MYSHOWS]: "My Shows",
	[TABS.DISCOVER]: "Discover",
	[TABS.SEARCH]: "Search",
	[TABS.PLAYER]: "Player",
	[TABS.SETTINGS]: "Settings",
};

/** Numeric TABS values, in declaration order (1..TabsCount). */
const TAB_ORDER = Object.values(TABS).filter(
	(v): v is TABS => typeof v === "number",
) as TABS[];

export function TabListPane(props: { muted?: boolean }) {
	const { theme } = useTheme();
	const nav = useNavigation();

	const cursor = () => nav.tabCursor();
	const active = () => nav.activeTab();
	const muted = () => props.muted ?? false;

	return (
		<For each={TAB_ORDER}>
			{(tab) => {
				const isCursor = () => cursor() === tab && !muted();
				const isActive = () => active() === tab;
				const fg = () =>
					isCursor()
						? theme.textSelectedPrimary
						: isActive()
							? theme.accent
							: theme.text;
				return (
					<box
						width="100%"
						height={1}
						flexDirection="row"
						backgroundColor={isCursor() ? theme.primary : "transparent"}
					>
						<text
							width={2}
							fg={isCursor() ? theme.textSelectedPrimary : "transparent"}
						>
							{isActive() ? "●" : " "}
						</text>
						<text
							width={2}
							fg={isCursor() ? theme.textSelectedPrimary : theme.textMuted}
						>
							{tab}
						</text>
						<text fg={fg()} paddingLeft={1}>
							{TAB_LABEL[tab]}
						</text>
					</box>
				);
			}}
		</For>
	);
}
