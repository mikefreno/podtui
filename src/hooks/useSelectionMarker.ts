/**
 * useSelectionMarker — reactive accessor for the row-selection marker glyph.
 *
 * When the `showSelectionMarker` setting is on, the focused row of every list
 * renders `❯`; when off (the default), it renders a space so column alignment
 * is preserved. Every list pane in the app reads the marker through this hook
 * so the setting applies consistently everywhere.
 */

import { useAppStore } from "@/stores/app";

export function useSelectionMarker(): () => string {
	const app = useAppStore();
	return () =>
		app.state().settings.showSelectionMarker ? "❯" : " ";
}
