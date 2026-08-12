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

/** Default episode lifecycle window in days — used when no preference is
 *  configured (legacy configs, first launch). The actual bound is the user's
 *  episodeCacheDays preference; this is just the fail-safe default. */
export const DEFAULT_EPISODE_WINDOW_DAYS = 60;

/** True when an episode falls inside a rolling date window of `days` days.
 *  A missing/invalid pubDate is ALWAYS kept (fail-safe: never drop an
 *  undatable episode) — the volatile cache must agree with
 *  episodeIsPersistable so an episode the persistence layer retains can
 *  never be silently pruned from the list. */
export function episodeInWindow(
	ep: Episode,
	now: Date,
	days: number = DEFAULT_EPISODE_WINDOW_DAYS,
): boolean {
	const t = ep.pubDate?.getTime();
	if (!t || Number.isNaN(t)) return true;
	return t >= now.getTime() - days * 24 * 3600 * 1000;
}

/** True when an episode may be persisted: a completed download, or it falls
 *  inside the lifecycle window (undatable episodes always kept). */
export function episodeIsPersistable(
	ep: Episode,
	downloadedIds: Set<string>,
	now: Date,
	days: number = DEFAULT_EPISODE_WINDOW_DAYS,
): boolean {
	return downloadedIds.has(ep.id) || episodeInWindow(ep, now, days);
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
export async function loadFeedsFromFile(
	windowDays?: number,
): Promise<Feed[]> {
	try {
		const cfg = await loadConfig();
		if (!Array.isArray(cfg.feeds)) return [];
		const feeds = cfg.feeds.map(reviveDates);
		const downloadedIds = await readDownloadedEpisodeIds();
		const now = new Date();
		let prunedAny = false;
		const pruned = feeds.map((f) => {
			const kept = f.episodes.filter((ep) =>
				episodeIsPersistable(ep, downloadedIds, now, windowDays),
			);
			if (kept.length !== f.episodes.length) prunedAny = true;
			return { ...f, episodes: kept };
		});
		if (prunedAny) {
			// Fire-and-forget cleanup rewrite of the legacy config.
			saveFeedsToFile(pruned, windowDays);
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
export function saveFeedsToFile(feeds: Feed[], windowDays?: number): void {
	(async () => {
		try {
			const downloadedIds = await readDownloadedEpisodeIds();
			const pruned = feeds.map((f) => ({
				...f,
				episodes: f.episodes.filter((ep) =>
					episodeIsPersistable(ep, downloadedIds, new Date(), windowDays),
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
