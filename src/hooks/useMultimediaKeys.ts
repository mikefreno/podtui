/**
 * Global multimedia key handler hook.
 *
 * Captures media-related key events (play/pause, volume, seek, speed)
 * regardless of which component is focused. Uses the event bus to
 * decouple key detection from audio control logic.
 *
 * Volume and speed are app-level settings — adjustable with or without
 * an episode loaded (they apply to the next playback and persist). Seek
 * is playback-dependent, so it still requires a loaded episode.
 */

import { useKeyboard } from "@opentui/solid";
import { emit } from "../utils/event-bus";

export type MediaKeyAction =
	| "media.toggle"
	| "media.volumeUp"
	| "media.volumeDown"
	| "media.seekForward"
	| "media.seekBackward"
	| "media.speedCycle";

export interface MultimediaKeysOptions {
	/** When true, skip handling (Player.tsx handles keys locally) */
	playerFocused?: () => boolean;
	/** When true, skip handling (text input has focus) */
	inputFocused?: () => boolean;
	/** Whether an episode is currently loaded */
	hasEpisode?: () => boolean;
}

/**
 * Registers a global keyboard listener that emits media events on the
 * event bus. Call once at the app level (e.g. in App.tsx).
 */
export function useMultimediaKeys(options: MultimediaKeysOptions = {}) {
	useKeyboard((key) => {
		// Don't intercept when a text input owns the keyboard
		if (options.inputFocused?.()) return;

		// Don't intercept when Player component handles its own keys
		if (options.playerFocused?.()) return;

		// Ctrl/Meta combos are app-level shortcuts, not media keys
		if (key.ctrl || key.meta) return;

		switch (key.name) {
			case "space":
				// Toggle play/pause — always valid (may start a loaded episode)
				emit("media.toggle", {});
				break;

			case "up":
				emit("media.volumeUp", {});
				break;

			case "down":
				emit("media.volumeDown", {});
				break;

			case "left":
				if (!options.hasEpisode?.()) return;
				emit("media.seekBackward", {});
				break;

			case "right":
				if (!options.hasEpisode?.()) return;
				emit("media.seekForward", {});
				break;

			case "s":
				emit("media.speedCycle", {});
				break;

			default:
				// Not a media key — do nothing
				break;
		}
	});
}
