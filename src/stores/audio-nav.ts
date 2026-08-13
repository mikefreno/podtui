/**
 * Audio navigation store for tracking episode order and position
 * Persists the current episode context (source type, index, and podcastId)
 */

import { createSignal } from "solid-js";
import {
	loadAudioNavFromFile,
	saveAudioNavToFile,
} from "../utils/app-persistence";

export enum AudioSource {
	FEED = "feed",
	MY_SHOWS = "my_shows",
	SEARCH = "search",
}

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

const defaultNavState: AudioNavState = {
	source: AudioSource.FEED,
	currentIndex: 0,
	lastUpdated: new Date(),
};

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
		get state(): AudioNavState {
			return navState();
		},

		setSource: (source: AudioSource, podcastId?: string) => {
			setNavState((prev) => ({
				...prev,
				source,
				podcastId,
				lastUpdated: new Date(),
			}));
			persist();
		},

		next: (currentIndex: number) => {
			setNavState((prev) => ({
				...prev,
				currentIndex,
				lastUpdated: new Date(),
			}));
			persist();
		},

		prev: (currentIndex: number) => {
			setNavState((prev) => ({
				...prev,
				currentIndex,
				lastUpdated: new Date(),
			}));
			persist();
		},

		reset: () => {
			setNavState(defaultNavState);
			persist();
		},

		getCurrentIndex: (): number => {
			return navState().currentIndex;
		},

		getSource: (): AudioSource => {
			return navState().source;
		},

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
