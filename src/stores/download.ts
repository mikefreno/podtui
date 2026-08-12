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
import type { Podcast } from "../types/podcast";
import { downloadEpisode } from "../utils/episode-downloader";
import { ensureConfigDir, getConfigFilePath } from "../utils/config-dir";
import { useFeedStore } from "./feed";

const DOWNLOADS_FILE = "downloads.json";
const MAX_CONCURRENT = 2;

/** Prefix for synthetic feed ids of unsubscribed-show downloads (search
 *  downloads). The id doubles as the file subdirectory name, so it must be
 *  filesystem-safe. */
const UNSUBSCRIBED_FEED_PREFIX = "unsub-";

/** Deterministic synthetic feed id for a show that isn't subscribed: groups
 *  its search downloads together (and names their file subdirectory) without
 *  colliding with real feed ids (UUIDs). */
function unsubscribedFeedId(podcast: Pick<Podcast, "feedUrl" | "title">): string {
	const base = podcast.feedUrl || podcast.title;
	const slug = base
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
	return `${UNSUBSCRIBED_FEED_PREFIX}${slug || "podcast"}`;
}

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
	/** ISO publication date, for unsubscribed-show downloads. */
	pubDate?: string;
	/** Show title, for downloads whose show isn't subscribed. */
	podcastTitle?: string;
	/** The show's RSS feed URL (re-classifies the download once subscribed). */
	podcastFeedUrl?: string;
}

/** Queue item for pending downloads */
interface QueueItem {
	episodeId: string;
	feedId: string;
	audioUrl: string;
	episodeTitle: string;
}

/** Create download store */
function createDownloadStore() {
	const [downloads, setDownloads] = createSignal<
		Map<string, DownloadedEpisode>
	>(new Map());
	const [queue, setQueue] = createSignal<QueueItem[]>([]);
	const [activeCount, setActiveCount] = createSignal(0);

	/** Active AbortControllers keyed by episodeId */
	const abortControllers = new Map<string, AbortController>();

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
					episodeTitle: rec.episodeTitle || undefined,
					audioUrl: rec.audioUrl || undefined,
					pubDate: rec.pubDate || undefined,
					podcastTitle: rec.podcastTitle || undefined,
					podcastFeedUrl: rec.podcastFeedUrl || undefined,
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
					audioUrl: dl.audioUrl ?? qItem?.audioUrl ?? "",
					episodeTitle: dl.episodeTitle ?? qItem?.episodeTitle ?? "",
					pubDate: dl.pubDate,
					podcastTitle: dl.podcastTitle,
					podcastFeedUrl: dl.podcastFeedUrl,
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

			// Write the podcast cover beside the audio so mpv's
			// --cover-art-auto=exact picks it up for Now Playing art when the
			// local file plays (same basename, .jpg extension — verified
			// against mpv 0.41). curl, NOT fetch: Bun's fetch hangs in
			// compiled binaries, so the shipped app never wrote this file.
			// Falls back to the episode's own image when the feed has no
			// channel cover (URL-added feeds).
			const feedStore = useFeedStore();
			const episode = feedStore.findEpisode(item.episodeId);
			const coverUrl =
				feedStore
					.feeds()
					.find((f) => f.id === item.feedId)?.podcast.coverUrl ??
				episode?.imageUrl;
			if (coverUrl && result.filePath) {
				const dot = result.filePath.lastIndexOf(".");
				if (dot > 0) {
					const coverPath = result.filePath.slice(0, dot) + ".jpg";
					Bun.spawn([
						"curl",
						"-sS",
						"--fail",
						"-m",
						"8",
						"--max-filesize",
						"2097152",
						"-o",
						coverPath,
						coverUrl,
					])
						.exited.catch(() => {});
				}
			}

			// Tag the local file (codec-copy, no re-encode) so mpv's Now
			// Playing metadata for local playback is title=episode,
			// artist=podcast — the source streams carry no usable tags and
			// macOS composes "title - artist" from exactly these fields.
			// Atomic: ffmpeg writes a temp file, then renames into place.
			if (result.filePath && episode) {
				const podcastTitle =
					feedStore.feeds().find((f) => f.id === item.feedId)?.podcast.title ??
					downloads().get(item.episodeId)?.podcastTitle;
				if (podcastTitle) {
					const tmp = `${result.filePath}.tag.mp3`;
					Bun.spawn([
						"ffmpeg",
						"-y",
						"-i",
						result.filePath,
						"-c",
						"copy",
						"-metadata",
						`title=${episode.title}`,
						"-metadata",
						`artist=${podcastTitle}`,
						tmp,
					])
						.exited.then(async (code) => {
							if (code !== 0) return;
							const { renameSync } = await import("node:fs");
							renameSync(tmp, result.filePath);
						})
						.catch(() => {});
				}
			}
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

	/** Optional metadata for a download whose show isn't subscribed (search
	 *  downloads) — without it the record cannot render a title or be
	 *  re-classified once the show is subscribed. */
	interface UnsubscribedMeta {
		podcastTitle: string;
		podcastFeedUrl?: string;
	}

	/** Start downloading an episode */
	const startDownload = (
		episode: Episode,
		feedId: string,
		meta?: UnsubscribedMeta,
	): void => {
		const existing = downloads().get(episode.id);
		if (
			existing?.status === DownloadStatus.DOWNLOADING ||
			existing?.status === DownloadStatus.QUEUED
		) {
			return; // Already downloading or queued
		}

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
			episodeTitle: episode.title,
			audioUrl: episode.audioUrl,
			pubDate: episode.pubDate.toISOString(),
			podcastTitle: meta?.podcastTitle,
			podcastFeedUrl: meta?.podcastFeedUrl,
		};

		setDownloads((prev) => {
			const next = new Map(prev);
			next.set(episode.id, entry);
			return next;
		});

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

	/** Start downloading an episode of a show that is NOT subscribed. The
	 *  download gets a deterministic synthetic feed id (also its file
	 *  subdirectory) plus the show's metadata so it can render under
	 *  "Unsubscribed Show Downloads" and re-classify if the user later
	 *  subscribes to the show. */
	const startUnsubscribedDownload = (
		episode: Episode,
		podcast: Podcast,
	): void => {
		startDownload(episode, unsubscribedFeedId(podcast), {
			podcastTitle: podcast.title,
			podcastFeedUrl: podcast.feedUrl || undefined,
		});
	};

	/** Cancel a download */
	const cancelDownload = (episodeId: string): void => {
		// Abort active download
		const controller = abortControllers.get(episodeId);
		if (controller) {
			controller.abort();
			abortControllers.delete(episodeId);
		}

		setQueue((prev) => prev.filter((q) => q.episodeId !== episodeId));

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
				const dot = dl.filePath.lastIndexOf(".");
				if (dot > 0) {
					const coverPath = dl.filePath.slice(0, dot) + ".jpg";
					await unlink(coverPath);
				}
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
	 *  abort in-flight transfers, drop queued items, delete files + metadata.
	 *  Also removes downloads of the same show made while it was unsubscribed
	 *  (matched by podcastFeedUrl) so unsubscribing purges search downloads
	 *  of that show too. */
	const removeDownloadsForFeed = async (
		feedId: string,
		podcastFeedUrl?: string,
	): Promise<void> => {
		const eps = Array.from(downloads().values()).filter(
			(d) =>
				d.feedId === feedId ||
				(podcastFeedUrl && d.podcastFeedUrl === podcastFeedUrl),
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

	/** Downloads whose show is not subscribed — the "Unsubscribed Show
	 *  Downloads" list shown in My Shows and the settings download manager.
	 *  Reads feeds() so the list re-classifies (drops out) the moment the
	 *  user subscribes to the show. Matched by feed id, or by the show's
	 *  feed URL (covers downloads made before the show was subscribed). */
	const getUnsubscribedDownloads = (): DownloadedEpisode[] => {
		const feeds = useFeedStore().feeds();
		return Array.from(downloads().values()).filter((d) => {
			if (feeds.some((f) => f.id === d.feedId)) return false;
			if (d.podcastFeedUrl) {
				return !feeds.some(
					(f) => f.podcast.feedUrl === d.podcastFeedUrl,
				);
			}
			return true;
		});
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
		getUnsubscribedDownloads,
		getQueue,
		getActiveCount,

		// Actions
		startDownload,
		startUnsubscribedDownload,
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
