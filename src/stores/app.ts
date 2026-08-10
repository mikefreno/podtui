import { createSignal } from "solid-js";
import { DEFAULT_THEME, THEME_JSON } from "../constants/themes";
import type {
	AppSettings,
	AppState,
	ThemeColors,
	ThemeName,
	ThemeMode,
	UserPreferences,
	VisualizerSettings,
} from "../types/settings";
import { resolveTheme } from "../utils/theme-resolver";
import type { ThemeJson } from "../types/theme-schema";
import {
	loadAppStateFromFile,
	saveAppStateToFile,
} from "../utils/app-persistence";

const defaultVisualizerSettings: VisualizerSettings = {
	bars: 64,
	sensitivity: 1,
	noiseReduction: 0.77,
	lowCutOff: 50,
	highCutOff: 10000,
};

const defaultSettings: AppSettings = {
	theme: "system",
	fontSize: 14,
	playbackSpeed: 1,
	downloadPath: "",
	transparentBackground: false,
	visualizer: defaultVisualizerSettings,
};

const defaultPreferences: UserPreferences = {
	showExplicit: false,
	autoDownload: false,
	autoDownloadCount: 2,
	autoDownloadScope: "all",
	autoDownloadWhitelist: [],
	autoJumpToPlayer: true,
	fetchMoreMode: "manual",
};

const defaultState: AppState = {
	settings: defaultSettings,
	preferences: defaultPreferences,
	customTheme: DEFAULT_THEME,
};

function createAppStore() {
	// Start with defaults; async load will update once ready
	const [state, setState] = createSignal<AppState>(defaultState);

	// Fire-and-forget async initialisation
	const init = async () => {
		const loaded = await loadAppStateFromFile();
		setState(loaded);
	};
	init();

	const saveState = (next: AppState) => {
		saveAppStateToFile(next);
	};

	const updateState = (next: AppState) => {
		setState(next);
		saveState(next);
	};

	const updateSettings = (updates: Partial<AppSettings>) => {
		const next = {
			...state(),
			settings: { ...state().settings, ...updates },
		};
		updateState(next);
	};

	const updatePreferences = (updates: Partial<UserPreferences>) => {
		const next = {
			...state(),
			preferences: { ...state().preferences, ...updates },
		};
		updateState(next);
	};

	const updateCustomTheme = (updates: Partial<ThemeColors>) => {
		const next = {
			...state(),
			customTheme: { ...state().customTheme, ...updates },
		};
		updateState(next);
	};

	const updateVisualizer = (updates: Partial<VisualizerSettings>) => {
		updateSettings({
			visualizer: { ...state().settings.visualizer, ...updates },
		});
	};

	const setTheme = (theme: ThemeName) => {
		updateSettings({ theme });
	};

	const resolveThemeColors = (): ThemeColors => {
		const theme = state().settings.theme;
		if (theme === "custom") return state().customTheme;
		if (theme === "system") return DEFAULT_THEME;
		const json = THEME_JSON[theme];
		if (!json) return DEFAULT_THEME;
		return resolveTheme(
			json as ThemeJson,
			"dark" as ThemeMode,
		) as unknown as ThemeColors;
	};

	return {
		state,
		updateSettings,
		updatePreferences,
		updateCustomTheme,
		updateVisualizer,
		setTheme,
		resolveTheme: resolveThemeColors,
	};
}

let appStoreInstance: ReturnType<typeof createAppStore> | null = null;

export function useAppStore() {
	if (!appStoreInstance) {
		appStoreInstance = createAppStore();
	}
	return appStoreInstance;
}
