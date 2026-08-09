/**
 * Audio navigation store for tracking episode order and position
 * Persists the current episode context (source type, index, and podcastId)
 */

import { createSignal } from "solid-js";
import {
	loadAudioNavFromFile,
	saveAudioNavToFile,
} from "../utils/app-persistence";

/** Source type for audio navigation */
export enum AudioSource {
	FEED = "feed",
	MY_SHOWS = "my_shows",
	SEARCH = "search",
}

/** Audio navigation state */
export interface AudioNavState {
	/** Current source type */
	source: AudioSource;
	/** Index of current episode in the ordered list */
	currentIndex: number;
	/** Podcast ID for My Shows source */
	podcastId?: string;
	/** Timestamp when navigation state was last saved */
	lastUpdated: Date;
}

/** Default navigation state */
const defaultNavState: AudioNavState = {
	source: AudioSource.FEED,
	currentIndex: 0,
	lastUpdated: new Date(),
};

/** Create audio navigation store */
function createAudioNavStore() {
	const [navState, setNavState] = createSignal<AudioNavState>(defaultNavState);

	/** Persist current navigation state to file (fire-and-forget) */
	function persist(): void {
		saveAudioNavToFile(navState());
	}

	/** Load navigation state from file */
	async function init(): Promise<void> {
		const loaded = await loadAudioNavFromFile<AudioNavState>();
		if (loaded) {
			setNavState(loaded);
		}
	}

	/** Fire-and-forget initialization */
	init();

	return {
		/** Get current navigation state */
		get state(): AudioNavState {
			return navState();
		},

		/** Update source type */
		setSource: (source: AudioSource, podcastId?: string) => {
			setNavState((prev) => ({
				...prev,
				source,
				podcastId,
				lastUpdated: new Date(),
			}));
			persist();
		},

		/** Move to next episode */
		next: (currentIndex: number) => {
			setNavState((prev) => ({
				...prev,
				currentIndex,
				lastUpdated: new Date(),
			}));
			persist();
		},

		/** Move to previous episode */
		prev: (currentIndex: number) => {
			setNavState((prev) => ({
				...prev,
				currentIndex,
				lastUpdated: new Date(),
			}));
			persist();
		},

		/** Reset to default state */
		reset: () => {
			setNavState(defaultNavState);
			persist();
		},

		/** Get current index */
		getCurrentIndex: (): number => {
			return navState().currentIndex;
		},

		/** Get current source */
		getSource: (): AudioSource => {
			return navState().source;
		},

		/** Get current podcast ID */
		getPodcastId: (): string | undefined => {
			return navState().podcastId;
		},
	};
}

/** Singleton instance */
let audioNavInstance: ReturnType<typeof createAudioNavStore> | null = null;

export function useAudioNavStore() {
	if (!audioNavInstance) {
		audioNavInstance = createAudioNavStore();
	}
	return audioNavInstance;
}
