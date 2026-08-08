/**
 * DownloadManager — exposes downloads as SettingItems for the depth-stack.
 *
 *   • "Delete All Downloads"   — action item; Enter wipes every download.
 *   • one item per show        — action item; Enter deletes all that show's
 *                               downloads (file + metadata, aborts in-flight).
 *   • one item per episode     — action item; Enter deletes a single download.
 *
 * Titles resolve from the feed store at render time (reactive), falling back
 * to the episode id when the feed is no longer loaded. Movement flows through
 * nav.action — no own useKeyboard (matches the other panels).
 */

import { useFeedStore } from "@/stores/feed";
import { useDownloadStore } from "@/stores/download";
import { DownloadStatus } from "@/types/episode";
import type { DownloadedEpisode } from "@/types/episode";
import type { SettingItem } from "./types";

/** Format a byte count as a compact human string. */
function fmtBytes(n: number): string {
	if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(1)} MB`;
	if (n >= 1 << 10) return `${(n / (1 << 10)).toFixed(0)} KB`;
	return `${n} B`;
}

/** Short status badge for an episode download. */
function statusLabel(s: DownloadStatus): string {
	switch (s) {
		case DownloadStatus.QUEUED:
			return "queued";
		case DownloadStatus.DOWNLOADING:
			return "downloading";
		case DownloadStatus.COMPLETED:
			return "done";
		case DownloadStatus.FAILED:
			return "failed";
		default:
			return "";
	}
}

/** Episode title for a download, resolved from the feed store (reactive). */
function episodeTitle(
	feedStore: ReturnType<typeof useFeedStore>,
	d: DownloadedEpisode,
): string {
	const feed = feedStore.getFeed(d.feedId);
	const ep = feed?.episodes.find((e) => e.id === d.episodeId);
	return ep?.title ?? d.episodeId;
}

/** Show title for a download's feed id. */
function feedTitle(
	feedStore: ReturnType<typeof useFeedStore>,
	feedId: string,
): string {
	const feed = feedStore.getFeed(feedId);
	return feed ? feed.customName || feed.podcast.title : feedId;
}

export function useDownloadItems(): SettingItem[] {
	const downloadStore = useDownloadStore();
	const feedStore = useFeedStore();

	const downloads = () => downloadStore.getAllDownloads();

	const items: SettingItem[] = [
		{
			id: "clear-all",
			label: "Delete All Downloads",
			kind: "action",
			display: () => `${downloads().length} files`,
			help: () =>
				`Delete every downloaded episode (files + metadata) and clear the\nqueue. Enter to run.`,
			run: () => {
				for (const d of downloads()) {
					downloadStore.cancelDownload(d.episodeId);
					downloadStore.removeDownload(d.episodeId).catch(() => {});
				}
			},
		},
	];

	// Group downloads by feed so each show gets a delete-by-show item.
	const byFeed = new Map<string, DownloadedEpisode[]>();
	for (const d of downloads()) {
		const arr = byFeed.get(d.feedId) ?? [];
		arr.push(d);
		byFeed.set(d.feedId, arr);
	}
	for (const [feedId, eps] of byFeed) {
		const size = eps.reduce((s, e) => s + e.fileSize, 0);
		items.push({
			id: `feed:${feedId}`,
			label: `Show: ${feedTitle(feedStore, feedId)}`,
			kind: "action",
			display: () => `${eps.length} · ${fmtBytes(size)}`,
			help: () =>
				`Delete all ${eps.length} downloads for this show (files + metadata,\naborts any in-flight transfers). Enter to run.`,
			run: () => {
				downloadStore.removeDownloadsForFeed(feedId).catch(() => {});
			},
		});
	}

	// One item per individual episode download.
	for (const d of downloads()) {
		items.push({
			id: `ep:${d.episodeId}`,
			label: episodeTitle(feedStore, d),
			kind: "action",
			display: () =>
				`${feedTitle(feedStore, d.feedId)} · ${statusLabel(d.status)} · ${fmtBytes(d.fileSize)}`,
			help: () =>
				`Delete this single download (file + metadata). Enter to run.`,
			run: () => {
				downloadStore.removeDownload(d.episodeId).catch(() => {});
			},
		});
	}

	return items;
}
