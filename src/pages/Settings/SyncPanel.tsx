/**
 * SyncPanel — exposes Import / Export / status as SettingItems. The Import and
 * Export dialogs render as depth-2 editors. No own useKeyboard.
 */

import { createSignal } from "solid-js";
import { ImportDialog } from "./ImportDialog";
import { ExportDialog } from "./ExportDialog";
import { SyncStatus } from "./SyncStatus";
import type { SettingItem } from "./types";

// Module-level state so the action items can open their dialogs as depth-2
// editors. The SettingsPage reads `syncEditor()` to decide which dialog to show.
const [syncEditor, setSyncEditor] = createSignal<"import" | "export" | null>(
	null,
);
export { syncEditor };
export function closeSyncEditor() {
	setSyncEditor(null);
}

export function useSyncItems(): SettingItem[] {
	return [
		{
			id: "import",
			label: "Import",
			kind: "editor",
			display: () => "→",
			help: () =>
				`Import subscriptions from a sync file (JSON or OPML).\nDrill in (Enter/l) to open the import dialog.\nType: editor`,
			renderEditor: () => <ImportDialog />,
		},
		{
			id: "export",
			label: "Export",
			kind: "editor",
			display: () => "→",
			help: () =>
				`Export subscriptions to a sync file.\nDrill in (Enter/l) to open the export dialog.\nType: editor`,
			renderEditor: () => <ExportDialog />,
		},
		{
			id: "status",
			label: "Status",
			kind: "info",
			display: () => "Idle",
			help: () =>
				`Last sync status. (Sync is run from the import/export dialogs.)\nType: info`,
		},
	];
}

/** Renders the live sync status block (used by the Settings page header for the
 *  Sync section, when relevant). */
export function SyncStatusBlock() {
	return <SyncStatus />;
}
