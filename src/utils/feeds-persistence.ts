/**
 * Feeds & sources persistence — stored in the centralized `config.json`
 * (see utils/config.ts). No backups; writes always overwrite.
 */

import { loadConfig, updateConfig } from "./config";
import type { Feed } from "../types/feed";
import type { PodcastSource } from "../types/source";

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

/** Load feeds from config.json */
export async function loadFeedsFromFile(): Promise<Feed[]> {
	try {
		const cfg = await loadConfig();
		if (!Array.isArray(cfg.feeds)) return [];
		return cfg.feeds.map(reviveDates);
	} catch {
		return [];
	}
}

/** Save feeds to config.json */
export function saveFeedsToFile(feeds: Feed[]): void {
	updateConfig({ feeds });
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
