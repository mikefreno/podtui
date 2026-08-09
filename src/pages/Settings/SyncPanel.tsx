/**
 * SyncPanel — exposes Import / Export / status as SettingItems. The Import and
 * Export dialogs render as depth-2 editors. No own useKeyboard.
 */

import { ImportDialog } from "./ImportDialog";
import { ExportDialog } from "./ExportDialog";
import type { SettingItem } from "./types";

// closeSyncEditor kept for SettingsPage's cleanup hook; its backing state
// (the syncEditor signal) was removed as dead — nothing ever read it.
export function closeSyncEditor() {}

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
