/**
 * Episode progress store for PodTUI
 *
 * Persists per-episode playback progress to a JSON file in XDG_CONFIG_HOME.
 * Tracks position, duration, completion, and last-played timestamp.
 */

import { createSignal } from "solid-js";
import type { Progress } from "../types/episode";
import {
	loadProgressFromFile,
	saveProgressToFile,
} from "../utils/app-persistence";

/** Threshold (fraction 0-1) at which an episode is considered completed */
const COMPLETION_THRESHOLD = 0.95;

/** Minimum seconds of progress before persisting */
const MIN_POSITION_TO_SAVE = 5;

// --- Singleton store ---

const [progressMap, setProgressMap] = createSignal<Record<string, Progress>>(
	{},
);

/** Persist current progress map to file (fire-and-forget) */
function persist(): void {
	saveProgressToFile(progressMap());
}

/** Parse raw progress entries from file, reviving Date objects */
function parseProgressEntries(
	raw: Record<string, unknown>,
): Record<string, Progress> {
	const result: Record<string, Progress> = {};
	for (const [key, value] of Object.entries(raw)) {
		const p = value as Record<string, unknown>;
		result[key] = {
			episodeId: p.episodeId as string,
			position: p.position as number,
			duration: p.duration as number,
			timestamp: new Date(p.timestamp as string),
			playbackSpeed: p.playbackSpeed as number | undefined,
		};
	}
	return result;
}

async function initProgress(): Promise<void> {
	const raw = await loadProgressFromFile();
	const parsed = parseProgressEntries(raw as Record<string, unknown>);
	setProgressMap(parsed);
}

// Fire-and-forget init; the promise is exposed via whenReady() so boot-time
// consumers (e.g. player-session restore) can await the file load.
const progressInit = initProgress();

function createProgressStore() {
	return {
		/**
		 * Resolves once the persisted progress map has been loaded from disk.
		 */
		whenReady: () => progressInit,

		get(episodeId: string): Progress | undefined {
			return progressMap()[episodeId];
		},

		all(): Record<string, Progress> {
			return progressMap();
		},

		/**
		 * Update progress for an episode. Only persists if position is meaningful.
		 */
		update(
			episodeId: string,
			position: number,
			duration: number,
			playbackSpeed?: number,
		): void {
			if (position < MIN_POSITION_TO_SAVE && duration > 0) return;

			setProgressMap((prev) => ({
				...prev,
				[episodeId]: {
					episodeId,
					position,
					duration,
					timestamp: new Date(),
					playbackSpeed,
				},
			}));
			persist();
		},

		isCompleted(episodeId: string): boolean {
			const p = progressMap()[episodeId];
			if (!p || p.duration <= 0) return false;
			return p.position / p.duration >= COMPLETION_THRESHOLD;
		},

		getPercent(episodeId: string): number {
			const p = progressMap()[episodeId];
			if (!p || p.duration <= 0) return 0;
			return Math.min(100, Math.round((p.position / p.duration) * 100));
		},

		/**
		 * Mark an episode as completed (set position to duration).
		 */
		markCompleted(episodeId: string): void {
			const p = progressMap()[episodeId];
			const duration = p?.duration ?? 0;
			setProgressMap((prev) => ({
				...prev,
				[episodeId]: {
					episodeId,
					position: duration,
					duration,
					timestamp: new Date(),
					playbackSpeed: p?.playbackSpeed,
				},
			}));
			persist();
		},

		/**
		 * Remove progress for an episode (e.g. "mark as new").
		 */
		remove(episodeId: string): void {
			setProgressMap((prev) => {
				const next = { ...prev };
				delete next[episodeId];
				return next;
			});
			persist();
		},

		clear(): void {
			setProgressMap({});
			persist();
		},
	};
}

// Singleton instance
let instance: ReturnType<typeof createProgressStore> | null = null;

export function useProgressStore() {
	if (!instance) {
		instance = createProgressStore();
	}
	return instance;
}
