/**
 * Settings item model — each settings section exposes a list of items that the
 * SettingsPage renders through the yazi depth-stack (sections → items → editor).
 *
 * All movement flows through the Shell's nav.action router (j/k move, Enter/l
 * drill, h back), so panels no longer register their own useKeyboard — that was
 * the root cause of the "right pane ignores keys / double-handled input" bugs.
 */
import type { JSX } from "solid-js";

export type SettingItemKind =
	| "toggle"
	| "number"
	| "select"
	| "action"
	| "editor"
	| "info";

export interface SettingItem {
	/** Stable id within its section. */
	id: string;
	/** One-line label shown in the items list. */
	label: string;
	/** Category — decides how the item is interacted with. */
	kind: SettingItemKind;
	/** Current value as a short string (shown to the right of the label). */
	display: () => string;
	/** Help text for the preview pane: description, type, default, current. */
	help: () => string;
	/** For number/select: nudge the value by -1 or +1 (j/k at depth 2). */
	cycle?: (dir: -1 | 1) => void;
	/** For toggle: flip the value (Space/Enter at depth 1). */
	toggle?: () => void;
	/** For action: run immediately (Enter at depth 1). */
	run?: () => void;
	/** For editor: a bespoke depth-2 editor component. */
	renderEditor?: () => JSX.Element;
}

export interface SettingsSectionDef {
	id: number;
	label: string;
	description: string;
	items?: () => SettingItem[];
}
