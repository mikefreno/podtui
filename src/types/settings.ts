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
	downloadPath: string;
	/** Render the app background transparent (let the terminal's own bg show). */
	transparentBackground: boolean;
	visualizer: VisualizerSettings;
};

export type UserPreferences = {
	showExplicit: boolean;
	autoDownload: boolean;
	/** Jump to the Player view automatically when playback starts (default: true) */
	autoJumpToPlayer: boolean;
};

export type AppState = {
	settings: AppSettings;
	preferences: UserPreferences;
	customTheme: ThemeColors;
};

export type ThemeMode = "dark" | "light";
export type ThemeVariantValue = Variant;
export type ThemeDefinition = ThemeJson;
