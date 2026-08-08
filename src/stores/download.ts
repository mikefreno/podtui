/**
 * Download store for PodTUI
 *
 * Manages per-episode download state with SolidJS signals, persists download
 * metadata to downloads.json in XDG_CONFIG_HOME, and provides a sequential
 * download queue (max 2 concurrent).
 */

import { createSignal } from "solid-js";
import { DownloadStatus } from "../types/episode";
import type { DownloadedEpisode } from "../types/episode";
import type { Episode } from "../types/episode";
import { downloadEpisode } from "../utils/episode-downloader";
import { ensureConfigDir, getConfigFilePath } from "../utils/config-dir";

const DOWNLOADS_FILE = "downloads.json";
const MAX_CONCURRENT = 2;

/** Serializable download record for persistence */
interface DownloadRecord {
	episodeId: string;
	feedId: string;
	status: DownloadStatus;
	filePath: string | null;
	downloadedAt: string | null;
	fileSize: number;
	error: string | null;
	audioUrl: string;
	episodeTitle: string;
}

/** Queue item for pending downloads */
interface QueueItem {
	episodeId: string;
	feedId: string;
	audioUrl: string;
	episodeTitle: string;
}

/** Create download store */
export function createDownloadStore() {
	const [downloads, setDownloads] = createSignal<
		Map<string, DownloadedEpisode>
	>(new Map());
	const [queue, setQueue] = createSignal<QueueItem[]>([]);
	const [activeCount, setActiveCount] = createSignal(0);

	/** Active AbortControllers keyed by episodeId */
	const abortControllers = new Map<string, AbortController>();

	// Load persisted downloads on init
	(async () => {
		const loaded = await loadDownloads();
		if (loaded.size > 0) setDownloads(loaded);
		// Resume any queued downloads from previous session
		resumeIncomplete();
	})();

	/** Load downloads from JSON file */
	async function loadDownloads(): Promise<Map<string, DownloadedEpisode>> {
		try {
			const filePath = getConfigFilePath(DOWNLOADS_FILE);
			const file = Bun.file(filePath);
			if (!(await file.exists())) return new Map();

			const raw: DownloadRecord[] = await file.json();
			if (!Array.isArray(raw)) return new Map();

			const map = new Map<string, DownloadedEpisode>();
			for (const rec of raw) {
				map.set(rec.episodeId, {
					episodeId: rec.episodeId,
					feedId: rec.feedId,
					status:
						rec.status === DownloadStatus.DOWNLOADING
							? DownloadStatus.QUEUED
							: rec.status,
					progress: rec.status === DownloadStatus.COMPLETED ? 100 : 0,
					filePath: rec.filePath,
					downloadedAt: rec.downloadedAt ? new Date(rec.downloadedAt) : null,
					speed: 0,
					fileSize: rec.fileSize,
					error: rec.error,
				});
			}
			return map;
		} catch {
			return new Map();
		}
	}

	/** Persist downloads to JSON file */
	async function saveDownloads(): Promise<void> {
		try {
			await ensureConfigDir();
			const map = downloads();
			const records: DownloadRecord[] = [];
			for (const [, dl] of map) {
				// Find the audioUrl from queue or use empty string
				const qItem = queue().find((q) => q.episodeId === dl.episodeId);
				records.push({
					episodeId: dl.episodeId,
					feedId: dl.feedId,
					status: dl.status,
					filePath: dl.filePath,
					downloadedAt: dl.downloadedAt?.toISOString() ?? null,
					fileSize: dl.fileSize,
					error: dl.error,
					audioUrl: qItem?.audioUrl ?? "",
					episodeTitle: qItem?.episodeTitle ?? "",
				});
			}
			const filePath = getConfigFilePath(DOWNLOADS_FILE);
			await Bun.write(filePath, JSON.stringify(records, null, 2));
		} catch {
			// Silently ignore write errors
		}
	}

	/** Resume incomplete downloads from a previous session */
	function resumeIncomplete(): void {
		const map = downloads();
		for (const [, dl] of map) {
			if (dl.status === DownloadStatus.QUEUED) {
				// Re-queue — but we lack audioUrl from persistence alone.
				// These will sit as QUEUED until the user re-triggers them.
			}
		}
	}

	/** Update a single download entry and trigger reactivity */
	function updateDownload(
		episodeId: string,
		updates: Partial<DownloadedEpisode>,
	): void {
		setDownloads((prev) => {
			const next = new Map(prev);
			const existing = next.get(episodeId);
			if (existing) {
				next.set(episodeId, { ...existing, ...updates });
			}
			return next;
		});
	}

	/** Process the download queue — starts downloads up to MAX_CONCURRENT */
	function processQueue(): void {
		const current = activeCount();
		const q = queue();

		if (current >= MAX_CONCURRENT || q.length === 0) return;

		const slotsAvailable = MAX_CONCURRENT - current;
		const toStart = q.slice(0, slotsAvailable);

		// Remove started items from queue
		if (toStart.length > 0) {
			setQueue((prev) => prev.slice(toStart.length));
		}

		for (const item of toStart) {
			executeDownload(item);
		}
	}

	/** Execute a single download */
	async function executeDownload(item: QueueItem): Promise<void> {
		const controller = new AbortController();
		abortControllers.set(item.episodeId, controller);
		setActiveCount((c) => c + 1);

		updateDownload(item.episodeId, {
			status: DownloadStatus.DOWNLOADING,
			progress: 0,
			speed: 0,
			error: null,
		});

		const result = await downloadEpisode(
			item.audioUrl,
			item.episodeTitle,
			item.feedId,
			(progress) => {
				updateDownload(item.episodeId, {
					progress: progress.percent >= 0 ? progress.percent : 0,
					speed: progress.speed,
					fileSize: progress.totalBytes,
				});
			},
			controller.signal,
		);

		abortControllers.delete(item.episodeId);
		setActiveCount((c) => Math.max(0, c - 1));

		if (result.success) {
			updateDownload(item.episodeId, {
				status: DownloadStatus.COMPLETED,
				progress: 100,
				filePath: result.filePath,
				fileSize: result.fileSize,
				downloadedAt: new Date(),
				speed: 0,
				error: null,
			});
		} else {
			updateDownload(item.episodeId, {
				status: DownloadStatus.FAILED,
				speed: 0,
				error: result.error ?? "Unknown error",
			});
		}

		saveDownloads().catch(() => {});
		// Process next items in queue
		processQueue();
	}

	/** Get download status for an episode */
	const getDownloadStatus = (episodeId: string): DownloadStatus => {
		return downloads().get(episodeId)?.status ?? DownloadStatus.NONE;
	};

	/** Get download progress for an episode (0-100) */
	const getDownloadProgress = (episodeId: string): number => {
		return downloads().get(episodeId)?.progress ?? 0;
	};

	/** Get full download info for an episode */
	const getDownload = (episodeId: string): DownloadedEpisode | undefined => {
		return downloads().get(episodeId);
	};

	/** Get the local file path for a completed download */
	const getDownloadedFilePath = (episodeId: string): string | null => {
		const dl = downloads().get(episodeId);
		if (dl?.status === DownloadStatus.COMPLETED && dl.filePath) {
			return dl.filePath;
		}
		return null;
	};

	/** Start downloading an episode */
	const startDownload = (episode: Episode, feedId: string): void => {
		const existing = downloads().get(episode.id);
		if (
			existing?.status === DownloadStatus.DOWNLOADING ||
			existing?.status === DownloadStatus.QUEUED
		) {
			return; // Already downloading or queued
		}

		// Create download entry
		const entry: DownloadedEpisode = {
			episodeId: episode.id,
			feedId,
			status: DownloadStatus.QUEUED,
			progress: 0,
			filePath: null,
			downloadedAt: null,
			speed: 0,
			fileSize: episode.fileSize ?? 0,
			error: null,
		};

		setDownloads((prev) => {
			const next = new Map(prev);
			next.set(episode.id, entry);
			return next;
		});

		// Add to queue
		const queueItem: QueueItem = {
			episodeId: episode.id,
			feedId,
			audioUrl: episode.audioUrl,
			episodeTitle: episode.title,
		};
		setQueue((prev) => [...prev, queueItem]);

		saveDownloads().catch(() => {});
		processQueue();
	};

	/** Cancel a download */
	const cancelDownload = (episodeId: string): void => {
		// Abort active download
		const controller = abortControllers.get(episodeId);
		if (controller) {
			controller.abort();
			abortControllers.delete(episodeId);
		}

		// Remove from queue
		setQueue((prev) => prev.filter((q) => q.episodeId !== episodeId));

		// Update status
		updateDownload(episodeId, {
			status: DownloadStatus.NONE,
			progress: 0,
			speed: 0,
			error: null,
		});

		saveDownloads().catch(() => {});
	};

	/** Remove a completed download (delete file and metadata) */
	const removeDownload = async (episodeId: string): Promise<void> => {
		const dl = downloads().get(episodeId);
		if (dl?.filePath) {
			try {
				const { unlink } = await import("fs/promises");
				await unlink(dl.filePath);
			} catch {
				// File may already be gone
			}
		}

		setDownloads((prev) => {
			const next = new Map(prev);
			next.delete(episodeId);
			return next;
		});

		saveDownloads().catch(() => {});
	};

	/** Remove every download (active/queued/completed) belonging to a feed —
	 *  abort in-flight transfers, drop queued items, delete files + metadata. */
	const removeDownloadsForFeed = async (feedId: string): Promise<void> => {
		const eps = Array.from(downloads().values()).filter(
			(d) => d.feedId === feedId,
		);
		for (const d of eps) {
			cancelDownload(d.episodeId);
			await removeDownload(d.episodeId);
		}
	};

	/** Get all downloads as an array */
	const getAllDownloads = (): DownloadedEpisode[] => {
		return Array.from(downloads().values());
	};

	/** Get the current queue */
	const getQueue = (): QueueItem[] => {
		return queue();
	};

	/** Get count of active downloads */
	const getActiveCount = (): number => {
		return activeCount();
	};

	return {
		// Getters
		getDownloadStatus,
		getDownloadProgress,
		getDownload,
		getDownloadedFilePath,
		getAllDownloads,
		getQueue,
		getActiveCount,

		// Actions
		startDownload,
		cancelDownload,
		removeDownload,
		removeDownloadsForFeed,
	};
}

/** Singleton download store */
let downloadStoreInstance: ReturnType<typeof createDownloadStore> | null = null;

export function useDownloadStore() {
	if (!downloadStoreInstance) {
		downloadStoreInstance = createDownloadStore();
	}
	return downloadStoreInstance;
}
