/**
 * Discover store for PodTUI
 * Manages trending/popular podcasts and category filtering.
 *
 * The featured-shows list is fetched at runtime from a JSON file hosted in the
 * GitHub repo (discover/featured.json on the `master` branch), so the list
 * can be updated without shipping a new release. The feed URL, de-duped set,
 * and version field act as the cache key — a fresh fetch only happens when the
 * version bumps or the cache window (24h) expires.
 */

import { createSignal } from "solid-js";
import type { Podcast } from "../types/podcast";
import type { Episode } from "../types/episode";
import { useFeedStore } from "./feed";

export interface DiscoverCategory {
	id: string;
	name: string;
	icon: string;
}

export const DISCOVER_CATEGORIES: DiscoverCategory[] = [
	{ id: "all", name: "All", icon: "\uF0CA" },
	{ id: "technology", name: "Technology", icon: "\uF2DB" },
	{ id: "science", name: "Science", icon: "\uF0C3" },
	{ id: "comedy", name: "Comedy", icon: "\uF118" },
	{ id: "news", name: "News", icon: "\uF1EA" },
	{ id: "business", name: "Business", icon: "\uF0B1" },
	{ id: "health", name: "Health", icon: "\uF21E" },
	{ id: "education", name: "Education", icon: "\uF19D" },
	{ id: "sports", name: "Sports", icon: "\uF1E3" },
	{ id: "true-crime", name: "True Crime", icon: "\uF00E" },
	{ id: "arts", name: "Arts", icon: "\uF1FC" },
];

// ── Remote featured-shows manifest ───────────────────────────────────────────
// The raw GitHub URL serving discover/featured.json from the master branch.
// Update this file in the repo (no release needed) to refresh the list.
const FEATURED_JSON_URL =
	"https://raw.githubusercontent.com/mikefreno/PodTui/master/discover/featured.json";

/** Cache window for the remote featured list (24 hours) */
const FEATURED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Max episodes to load when previewing an unsubscribed show's episode list
 *  from Discover (drill-in, no subscription). Mirrors the refresh window. */
const PREVIEW_EPISODE_LIMIT = 50;

/** Shape of a single entry in the remote JSON */
interface FeaturedEntry {
	id: string;
	title: string;
	description: string;
	feedUrl: string;
	author?: string;
	categories?: string[];
}

/** Shape of the remote JSON manifest */
interface FeaturedManifest {
	version: number;
	podcasts: FeaturedEntry[];
}

/** Convert a JSON entry to a runtime Podcast (adding derived fields) */
function entryToPodcast(entry: FeaturedEntry): Podcast {
	return {
		id: entry.id,
		title: entry.title,
		description: entry.description,
		feedUrl: entry.feedUrl,
		author: entry.author,
		categories: entry.categories ?? [],
		coverUrl: undefined,
		lastUpdated: new Date(),
		isSubscribed: false,
	};
}

/** Reconcile isSubscribed state across the discover list against the feed store */
function syncSubscriptionState(
	podcasts: Podcast[],
	subscribedUrls: Set<string>,
	subscribedIds: Set<string>,
): Podcast[] {
	return podcasts.map((p) => ({
		...p,
		isSubscribed: subscribedUrls.has(p.feedUrl) || subscribedIds.has(p.id),
	}));
}

export function createDiscoverStore() {
	const [selectedCategory, setSelectedCategory] = createSignal<string>("all");
	const [isLoading, setIsLoading] = createSignal(false);
	const [podcasts, setPodcasts] = createSignal<Podcast[]>([]);

	// Episodes fetched for an unsubscribed show's preview list (drill-in from
	// a podcast result, no subscription). Cached per podcast id for the
	// session; keyed by id so switching shows never clobbers another's list.
	const [previewEpisodes, setPreviewEpisodes] = createSignal<
		Record<string, Episode[]>
	>({});
	const [previewLoading, setPreviewLoading] = createSignal<Set<string>>(
		new Set(),
	);
	const [previewErrors, setPreviewErrors] = createSignal<
		Record<string, string>
	>({});

	// In-memory cache timestamp for the remote manifest (within 24h, skip refetch)
	let cachedAt = 0;

	/** Reconcile local isSubscribed flags with the feed store */
	const syncSubscriptions = () => {
		const feedStore = useFeedStore();
		const feeds = feedStore.feeds();
		const urls = new Set(feeds.map((f) => f.podcast.feedUrl));
		const ids = new Set(feeds.map((f) => f.podcast.id));
		setPodcasts((prev) => syncSubscriptionState(prev, urls, ids));
	};

	/** Fetch the featured-shows manifest from GitHub if stale */
	const refresh = async () => {
		setIsLoading(true);
		try {
			const now = Date.now();
			if (now - cachedAt < FEATURED_CACHE_TTL_MS) {
				syncSubscriptions();
				return;
			}

			const resp = await fetch(FEATURED_JSON_URL, {
				headers: { "User-Agent": "PodTUI/1.0" },
			});
			if (!resp.ok) {
				syncSubscriptions();
				return;
			}
			const manifest = (await resp.json()) as FeaturedManifest;
			if (!manifest?.podcasts?.length) {
				syncSubscriptions();
				return;
			}

			const fetched = manifest.podcasts.map(entryToPodcast);
			cachedAt = now;
			setPodcasts(fetched);

			syncSubscriptions();
		} catch {
			// Network failure — keep whatever we have (stale or empty)
		} finally {
			setIsLoading(false);
		}
	};

	const filteredPodcasts = () => {
		const category = selectedCategory();
		if (category === "all") {
			return podcasts();
		}

		return podcasts().filter((p) => {
			const cats = p.categories?.map((c) => c.toLowerCase()) ?? [];
			return cats.some((c) =>
				c.includes(category.toLowerCase().replace("-", " ")),
			);
		});
	};

	const subscribe = (podcastId: string) => {
		const podcast = podcasts().find((p) => p.id === podcastId);
		if (podcast) {
			// Actually add the feed to the feed store
			const feedStore = useFeedStore();
			feedStore.addFeed(podcast, "discover").catch(() => {});
		}
		setPodcasts((prev) =>
			prev.map((p) => (p.id === podcastId ? { ...p, isSubscribed: true } : p)),
		);
	};

	const unsubscribe = (podcastId: string) => {
		const podcast = podcasts().find((p) => p.id === podcastId);
		if (podcast) {
			const feedStore = useFeedStore();
			feedStore.removeFeedByUrl(podcast.feedUrl);
		}
		setPodcasts((prev) =>
			prev.map((p) => (p.id === podcastId ? { ...p, isSubscribed: false } : p)),
		);
	};

	// ── episode preview (drill-in, no subscription) ──────────────────────────
	/** Cached episode list for a previewed show (empty until first drill-in). */
	const episodesForPodcast = (podcastId: string): Episode[] =>
		previewEpisodes()[podcastId] ?? [];

	const isLoadingEpisodesFor = (podcastId: string): boolean =>
		previewLoading().has(podcastId);

	const previewError = (podcastId: string): string | undefined =>
		previewErrors()[podcastId];

	/** Fetch a show's episode list WITHOUT subscribing (Discover preview).
	 *  The list is cached per podcast id; a failed fetch records an error
	 *  and keeps any previous cache (a retry via refreshEpisodes clears it). */
	const openEpisodes = async (podcast: Podcast): Promise<void> => {
		if (previewEpisodes()[podcast.id] || previewLoading().has(podcast.id))
			return;
		if (!podcast.feedUrl) {
			setPreviewErrors((prev) => ({
				...prev,
				[podcast.id]: "No RSS feed listed for this show.",
			}));
			return;
		}
		setPreviewLoading((prev) => new Set(prev).add(podcast.id));
		const feedStore = useFeedStore();
		const { episodes } = await feedStore.fetchEpisodes(
			podcast.feedUrl,
			PREVIEW_EPISODE_LIMIT,
		);
		if (episodes) {
			setPreviewEpisodes((prev) => ({ ...prev, [podcast.id]: episodes }));
		} else {
			setPreviewErrors((prev) => ({
				...prev,
				[podcast.id]: "Couldn't load episodes.",
			}));
		}
		setPreviewLoading((prev) => {
			const next = new Set(prev);
			next.delete(podcast.id);
			return next;
		});
	};

	/** Re-fetch a previewed show's episode list (`r` on the episodes depth). */
	const refreshEpisodes = async (podcast: Podcast): Promise<void> => {
		setPreviewErrors((prev) => {
			const next = { ...prev };
			delete next[podcast.id];
			return next;
		});
		setPreviewEpisodes((prev) => {
			const next = { ...prev };
			delete next[podcast.id];
			return next;
		});
		await openEpisodes(podcast);
	};

	return {
		// State
		selectedCategory,
		isLoading,
		podcasts,
		filteredPodcasts,
		categories: DISCOVER_CATEGORIES,

		// Actions
		setSelectedCategory,
		subscribe,
		unsubscribe,
		refresh,

		// Episode preview (drill-in, no subscription)
		episodesForPodcast,
		isLoadingEpisodesFor,
		previewError,
		openEpisodes,
		refreshEpisodes,
	};
}

let discoverStoreInstance: ReturnType<typeof createDiscoverStore> | null = null;

export function useDiscoverStore() {
	if (!discoverStoreInstance) {
		discoverStoreInstance = createDiscoverStore();
	}
	return discoverStoreInstance;
}
