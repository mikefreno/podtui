/**
 * PreferencesPanel — exposes theme/font/speed/explicit/auto-download as
 * SettingItems for the yazi depth-stack. No own useKeyboard; all movement is
 * driven by the Shell router via nav.action.
 */

import { useAppStore } from "@/stores/app";
import type { ThemeName } from "@/types/settings";
import type { SettingItem } from "./types";

const THEME_LABELS: Array<{ value: ThemeName; label: string }> = [
	{ value: "system", label: "System" },
	{ value: "catppuccin", label: "Catppuccin" },
	{ value: "gruvbox", label: "Gruvbox" },
	{ value: "tokyo", label: "Tokyo" },
	{ value: "nord", label: "Nord" },
	{ value: "custom", label: "Custom" },
];

export function usePreferencesItems(): SettingItem[] {
	const app = useAppStore();

	const settings = () => app.state().settings;
	const prefs = () => app.state().preferences;

	return [
		{
			id: "theme",
			label: "Theme",
			kind: "select",
			display: () =>
				THEME_LABELS.find((t) => t.value === settings().theme)?.label ??
				settings().theme,
			help: () =>
				`Color theme.\nType: select\nDefault: system\nCurrent: ${settings().theme}\nCycle with j/k; Enter to apply.`,
			cycle: (dir) => {
				const idx = THEME_LABELS.findIndex((t) => t.value === settings().theme);
				const next = (idx + dir + THEME_LABELS.length) % THEME_LABELS.length;
				app.setTheme(THEME_LABELS[next].value);
			},
		},
		{
			id: "transparentBackground",
			label: "Transparent Background",
			kind: "toggle",
			display: () =>
				settings().transparentBackground ? "On" : "Off",
			help: () =>
				`Let the terminal's own background show through (no app background fill).\nType: toggle\nDefault: false\nCurrent: ${settings().transparentBackground ? "On" : "Off"}\nSpace/Enter to toggle.`,
			toggle: () =>
				app.updateSettings({
					transparentBackground: !settings().transparentBackground,
				}),
		},
		{
			id: "fontSize",
			label: "Font Size",
			kind: "number",
			display: () => `${settings().fontSize}px`,
			help: () =>
				`Terminal font size in pixels.\nType: number (10–20)\nDefault: 14\nCurrent: ${settings().fontSize}\nj/k to −/+1px.`,
			cycle: (dir) => {
				const next = Math.min(20, Math.max(10, settings().fontSize + dir));
				app.updateSettings({ fontSize: next });
			},
		},
		{
			id: "playbackSpeed",
			label: "Playback Speed",
			kind: "number",
			display: () => `${settings().playbackSpeed}x`,
			help: () =>
				`Default audio playback speed.\nType: number (0.5–2.0)\nDefault: 1.0\nCurrent: ${settings().playbackSpeed}\nj/k to −/+0.1.`,
			cycle: (dir) => {
				const next = Math.min(
					2,
					Math.max(0.5, settings().playbackSpeed + dir * 0.1),
				);
				app.updateSettings({ playbackSpeed: Number(next.toFixed(1)) });
			},
		},
		{
			id: "showExplicit",
			label: "Show Explicit",
			kind: "toggle",
			display: () => (prefs().showExplicit ? "On" : "Off"),
			help: () =>
				`Whether to list explicit episodes.\nType: toggle\nDefault: true\nCurrent: ${prefs().showExplicit}\nSpace/Enter to toggle.`,
			toggle: () =>
				app.updatePreferences({
					showExplicit: !prefs().showExplicit,
				}),
		},
		{
			id: "autoDownload",
			label: "Auto Download",
			kind: "toggle",
			display: () => (prefs().autoDownload ? "On" : "Off"),
			help: () =>
				`Download new episodes automatically.\nType: toggle\nDefault: false\nCurrent: ${prefs().autoDownload}\nSpace/Enter to toggle.`,
			toggle: () =>
				app.updatePreferences({
					autoDownload: !prefs().autoDownload,
				}),
		},
		{
			id: "autoJumpToPlayer",
			label: "Auto Jump to Player",
			kind: "toggle",
			display: () => (prefs().autoJumpToPlayer ? "On" : "Off"),
			help: () =>
				`Jump to the Player view automatically when a podcast starts.\nType: toggle\nDefault: true\nCurrent: ${prefs().autoJumpToPlayer ? "On" : "Off"}\nSpace/Enter to toggle.`,
			toggle: () =>
				app.updatePreferences({
					autoJumpToPlayer: !prefs().autoJumpToPlayer,
				}),
		},
	];
}
