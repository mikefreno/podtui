/**
 * TabListPane — the tab list as a pane you can drop into the UP | CURRENT |
 * PREVIEW flow (replaces the old fixed chrome tab column).
 *
 * Renders one row per tab (digit + label) using the same selection UI every
 * other yazi pane uses: the CURSOR row (the one j/k hovers) gets a `❯` marker
 * and the focus background (`theme.primary` when this pane is the CURRENT
 * column, `theme.border` when it is the muted UP/parent column). The ACTIVE
 * tab (the one whose content is open) always carries a `●` marker in accent so
 * it stays readable in both positions.
 *
 * `muted` marks the parent-column rendering: the highlight is dimmed (border
 * bg, text fg) rather than suppressed, so the Up pane still shows the cursor
 * and active tab — matching how every other pane's parent column renders its
 * focused row.
 */

import { For } from "solid-js";
import { useTheme } from "@/context/ThemeContext";
import { useNavigation } from "@/context/NavigationContext";
import { useScrollIntoView } from "@/hooks/useScrollIntoView";
import { useSelectionMarker } from "@/hooks/useSelectionMarker";
import { TABS } from "@/utils/navigation";
import { NF_ICONS, supportsNerdFonts } from "@/utils/nerd-fonts";

const TAB_LABEL: Record<TABS, string> = {
  [TABS.FEED]: "Feed",
  [TABS.MYSHOWS]: "My Shows",
  [TABS.DISCOVER]: "Discover",
  [TABS.SEARCH]: "Search",
  [TABS.PLAYER]: "Player",
  [TABS.SETTINGS]: "Settings",
};

/** Nerd Font glyph per tab (rendered only when the terminal supports them). */
const TAB_ICON: Record<TABS, string> = {
  [TABS.FEED]: NF_ICONS.feed,
  [TABS.MYSHOWS]: NF_ICONS.shows,
  [TABS.DISCOVER]: NF_ICONS.discover,
  [TABS.SEARCH]: NF_ICONS.search,
  [TABS.PLAYER]: NF_ICONS.player,
  [TABS.SETTINGS]: NF_ICONS.settings,
};

/** Numeric TABS values, in declaration order (1..TabsCount). */
const TAB_ORDER = Object.values(TABS).filter(
  (v): v is TABS => typeof v === "number",
) as TABS[];

export function TabListPane(props: { muted?: boolean }) {
  // Static: detection never changes mid-session.
  const nerd = supportsNerdFonts();
  const { theme } = useTheme();
  const nav = useNavigation();
  const marker = useSelectionMarker();

  const cursor = () => nav.tabCursor();
  const activeTab = () => nav.activeTab();
  /** `active=true` when this pane is the CURRENT column (Shell root);
   *  `false` when it is the muted UP/parent column (pages' parent pane). */
  const active = () => !props.muted;

  // Same focus-bg / focus-fg contract every other pane uses.
  const focusBg = (t: TABS) =>
    t === cursor() && active()
      ? theme.primary
      : t === cursor()
      ? theme.border
      : undefined;
  const focusFg = (t: TABS) =>
    t === cursor() && active()
      ? theme.surface
      : t === cursor()
      ? theme.selectedListItemText ?? theme.text
      : theme.text;

  return (
    <For each={TAB_ORDER}>
      {(tab) => {
        const isCursor = () => cursor() === tab;
        const isActive = () => activeTab() === tab;
        // The active tab is only accented in the Up/parent position — when this
        // pane is CURRENT, the cursor highlight is the only highlight.
        const labelFg = () =>
          isCursor()
            ? focusFg(tab)
            : isActive() && !active()
            ? theme.accent
            : theme.text;
        const ref = useScrollIntoView(isCursor);
        return (
          <box
            ref={ref}
            width="100%"
            height={1}
            flexDirection="row"
            paddingRight={1}
            backgroundColor={focusBg(tab)}
            onMouseDown={() => {
              // Click = hover + open, the yazi "open" of the row
              // (switches to the tab and enters its content), the same
              // as l/Enter. Restores mouse support the tab-strip
              // refactor dropped.
              nav.setTabCursor(tab);
              nav.activateTabCursor();
            }}
          >
            {/* ── selection marker (j/k cursor) ─────────────────────────── */}
            <text fg={focusFg(tab)}>{isCursor() ? marker() : " "}</text>
            {nerd && (
              <text fg={focusFg(tab)} paddingRight={1}>
                {TAB_ICON[tab]}
              </text>
            )}
            <text fg={labelFg()} paddingLeft={1}>
              {TAB_LABEL[tab]}
            </text>
          </box>
        );
      }}
    </For>
  );
}
