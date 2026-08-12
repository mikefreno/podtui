/**
 * Feeds & sources persistence — stored in the centralized `config.json`
 * (see utils/config.ts). No backups; writes always overwrite.
 */

import { loadConfig, updateConfig } from "./config";
import { getConfigFilePath } from "./config-dir";
import { DownloadStatus } from "../types/episode";
import type { Episode } from "../types/episode";
import type { Feed } from "../types/feed";
import type { PodcastSource } from "../types/source";

/** Retention window for persisted episodes: older episodes are dropped when
 *  feeds are written to config.json unless they are completed downloads. */
export const PERSISTED_WINDOW_DAYS = 30;

/** True when an episode may be persisted: it is a completed download, or its
 *  pubDate is missing/invalid (fail-safe: never drop an undatable episode),
 *  or it falls inside the retention window. */
export function episodeIsPersistable(
	ep: Episode,
	downloadedIds: Set<string>,
	now: Date,
): boolean {
	if (downloadedIds.has(ep.id)) return true;
	const t = ep.pubDate?.getTime();
	if (!t || Number.isNaN(t)) return true;
	return t >= now.getTime() - PERSISTED_WINDOW_DAYS * 24 * 3600 * 1000;
}

/** Episode ids of completed downloads, read from downloads.json. In-flight
 *  downloads are NOT exempted from the retention window — a just-completed
 *  download is re-included by the next save because the in-memory
 *  feed.episodes still holds it. Missing/unreadable/invalid file → empty set. */
async function readDownloadedEpisodeIds(): Promise<Set<string>> {
	try {
		const file = Bun.file(getConfigFilePath("downloads.json"));
		if (!(await file.exists())) return new Set();
		const raw = await file.json();
		if (!Array.isArray(raw)) return new Set();
		const ids = new Set<string>();
		for (const rec of raw) {
			if (
				rec &&
				typeof rec === "object" &&
				rec.status === DownloadStatus.COMPLETED &&
				typeof rec.episodeId === "string"
			) {
				ids.add(rec.episodeId);
			}
		}
		return ids;
	} catch {
		return new Set();
	}
}

/** Deserialize date strings back to Date objects in feed data */
function reviveDates(feed: Feed): Feed {
	return {
		...feed,
		lastUpdated: new Date(feed.lastUpdated),
		podcast: {
			...feed.podcast,
			lastUpdated: new Date(feed.podcast.lastUpdated),
		},
		episodes: feed.episodes.map((ep) => ({
			...ep,
			pubDate: new Date(ep.pubDate),
		})),
	};
}

/** Load feeds from config.json, pruning episodes outside the retention
 *  window (completed downloads always kept). When anything was pruned, the
 *  pruned list is rewritten to config.json (startup cleanup for legacy
 *  configs). The read path is awaited so the returned value is deterministic. */
export async function loadFeedsFromFile(): Promise<Feed[]> {
	try {
		const cfg = await loadConfig();
		if (!Array.isArray(cfg.feeds)) return [];
		const feeds = cfg.feeds.map(reviveDates);
		const downloadedIds = await readDownloadedEpisodeIds();
		const now = new Date();
		let prunedAny = false;
		const pruned = feeds.map((f) => {
			const kept = f.episodes.filter((ep) =>
				episodeIsPersistable(ep, downloadedIds, now),
			);
			if (kept.length !== f.episodes.length) prunedAny = true;
			return { ...f, episodes: kept };
		});
		if (prunedAny) {
			// Fire-and-forget cleanup rewrite of the legacy config.
			saveFeedsToFile(pruned);
		}
		return pruned;
	} catch {
		return [];
	}
}

/** Save feeds to config.json, pruning episodes outside the retention window
 *  (completed downloads always kept). Fire-and-forget: the prune reads
 *  downloads.json asynchronously, then enqueues the write. On any error the
 *  UNPRUNED feeds are saved instead, so data is never lost. */
export function saveFeedsToFile(feeds: Feed[]): void {
	(async () => {
		try {
			const downloadedIds = await readDownloadedEpisodeIds();
			const pruned = feeds.map((f) => ({
				...f,
				episodes: f.episodes.filter((ep) =>
					episodeIsPersistable(ep, downloadedIds, new Date()),
				),
			}));
			updateConfig({ feeds: pruned });
		} catch {
			updateConfig({ feeds }); /* never lose data on an error path */
		}
	})().catch(() => {});
}

/** Load sources from config.json */
export async function loadSourcesFromFile<T>(): Promise<T[] | null> {
	try {
		const cfg = await loadConfig();
		if (!Array.isArray(cfg.sources)) return null;
		return cfg.sources as T[];
	} catch {
		return null;
	}
}

/** Save sources to config.json */
export function saveSourcesToFile<T>(sources: T[]): void {
	updateConfig({ sources: sources as unknown as PodcastSource[] });
}
