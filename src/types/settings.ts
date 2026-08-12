import type { RGBA } from "@opentui/core";
import type { ColorValue, ThemeJson, Variant } from "./theme-schema";

export type ThemeName =
	| "system"
	| "catppuccin"
	| "gruvbox"
	| "tokyo"
	| "nord"
	| "custom";

export type LayerBackgrounds = {
	layer0: ColorValue;
	layer1: ColorValue;
	layer2: ColorValue;
	layer3: ColorValue;
};

export type ThemeColors = {
	background: ColorValue;
	surface: ColorValue;
	primary: ColorValue;
	secondary: ColorValue;
	accent: ColorValue;
	text: ColorValue;
	textPrimary?: ColorValue;
	textSecondary?: ColorValue;
	textTertiary?: ColorValue;
	textSelectedPrimary?: ColorValue;
	textSelectedSecondary?: ColorValue;
	textSelectedTertiary?: ColorValue;
	muted: ColorValue;
	warning: ColorValue;
	error: ColorValue;
	success: ColorValue;
	layerBackgrounds?: LayerBackgrounds;
	_hasSelectedListItemText?: boolean;
	thinkingOpacity?: number;
	selectedListItemText?: ColorValue;
};

export type ThemeVariant = {
	name: string;
	colors: ThemeColors;
};

export type ThemeToken = {
	[key: string]: string;
};

export type ResolvedTheme = Record<string, RGBA> & {
	layerBackgrounds: Record<string, RGBA>;
	_hasSelectedListItemText: boolean;
	thinkingOpacity: number;
};

export type DesktopTheme = {
	name: string;
	variants: ThemeVariant[];
	defaultVariant: string;
	tokens: ThemeToken;
};

export type VisualizerSettings = {
	/** Master on/off switch for the player's realtime waveform (default: on). */
	enabled: boolean;
	/** Number of frequency bars (8–128, default: 64) */
	bars: number;
	/** Automatic sensitivity: 1 = enabled, 0 = disabled (default: 1) */
	sensitivity: number;
	/** Noise reduction factor 0.0–1.0 (default: 0.77) */
	noiseReduction: number;
	/** Low frequency cutoff in Hz (default: 50) */
	lowCutOff: number;
	/** High frequency cutoff in Hz (default: 10000) */
	highCutOff: number;
};

export type AppSettings = {
	theme: ThemeName;
	fontSize: number;
	playbackSpeed: number;
	/** Playback volume 0–1 (default: 1 = 100%). */
	volume: number;
	downloadPath: string;
	/** Render the app background transparent (let the terminal's own bg show). */
	transparentBackground: boolean;
	/** Show the `❯` cursor marker on the focused row of every list (default: off). */
	showSelectionMarker: boolean;
	visualizer: VisualizerSettings;
};

/** How the Feed and per-show episode lists load older episodes (default: auto). */
export type FetchMoreMode = "manual" | "auto";

/** Which shows the auto-download setting applies to (default: all). */
export type AutoDownloadScope = "all" | "none" | "whitelist";

/** How the episode cache (the Feed / My Shows list + the pagination cache)
 *  is bounded: by a rolling date window or by a count of most-recent
 *  episodes (default: date). */
export type EpisodeCacheMode = "date" | "count";

export type UserPreferences = {
	showExplicit: boolean;
	autoDownload: boolean;
	/** Most recent episodes to auto-download per in-scope show (default: 2). */
	autoDownloadCount: number;
	/** Shows auto-download covers: all / none / whitelist (default: all). */
	autoDownloadScope: AutoDownloadScope;
	/** Feed ids in the auto-download whitelist (used when scope is "whitelist"). */
	autoDownloadWhitelist: string[];
	/** Jump to the Player view automatically when playback starts (default: true) */
	autoJumpToPlayer: boolean;
	/** Load older episodes from the Feed list: manual button or automatic at the bottom (default: auto). */
	fetchMoreMode: FetchMoreMode;
	/** Minutes between automatic background feed refreshes (default: 30). */
	refreshIntervalMinutes: number;
	/** How the episode list cache is bounded — by date or by count (default: date). */
	episodeCacheMode: EpisodeCacheMode;
	/** Number of most-recent episodes to keep when mode is "count" (default: 25). */
	episodeCacheCount: number;
	/** Rolling window in days for the episode list when mode is "date" (default: 60). */
	episodeCacheDays: number;
};

export type AppState = {
	settings: AppSettings;
	preferences: UserPreferences;
	customTheme: ThemeColors;
};

export type ThemeMode = "dark" | "light";
export type ThemeVariantValue = Variant;
export type ThemeDefinition = ThemeJson;
