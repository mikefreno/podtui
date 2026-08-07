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
import { useFeedStore } from "./feed";

export interface DiscoverCategory {
	id: string;
	name: string;
	icon: string;
}

export const DISCOVER_CATEGORIES: DiscoverCategory[] = [
	{ id: "all", name: "All", icon: "*" },
	{ id: "technology", name: "Technology", icon: ">" },
	{ id: "science", name: "Science", icon: "~" },
	{ id: "comedy", name: "Comedy", icon: ")" },
	{ id: "news", name: "News", icon: "!" },
	{ id: "business", name: "Business", icon: "$" },
	{ id: "health", name: "Health", icon: "+" },
	{ id: "education", name: "Education", icon: "?" },
	{ id: "sports", name: "Sports", icon: "#" },
	{ id: "true-crime", name: "True Crime", icon: "%" },
	{ id: "arts", name: "Arts", icon: "@" },
];

// ── Remote featured-shows manifest ───────────────────────────────────────────
// The raw GitHub URL serving discover/featured.json from the master branch.
// Update this file in the repo (no release needed) to refresh the list.
const FEATURED_JSON_URL =
	"https://raw.githubusercontent.com/mikefreno/PodTui/master/discover/featured.json";

/** Cache window for the remote featured list (24 hours) */
const FEATURED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

/** Create discover store */
export function createDiscoverStore() {
	const [selectedCategory, setSelectedCategory] = createSignal<string>("all");
	const [isLoading, setIsLoading] = createSignal(false);
	const [podcasts, setPodcasts] = createSignal<Podcast[]>([]);

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
			// Skip if cache is still fresh
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

			// Build the podcast list from the manifest entries
			const fetched = manifest.podcasts.map(entryToPodcast);
			cachedAt = now;
			setPodcasts(fetched);

			// Reflect current feed-store subscriptions
			syncSubscriptions();
		} catch {
			// Network failure — keep whatever we have (stale or empty)
		} finally {
			setIsLoading(false);
		}
	};

	/** Get filtered podcasts by category */
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

	/** Subscribe to a podcast */
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

	/** Unsubscribe from a podcast */
	const unsubscribe = (podcastId: string) => {
		const podcast = podcasts().find((p) => p.id === podcastId);
		if (podcast) {
			// Remove the feed from the feed store
			const feedStore = useFeedStore();
			feedStore.removeFeedByUrl(podcast.feedUrl);
		}
		setPodcasts((prev) =>
			prev.map((p) => (p.id === podcastId ? { ...p, isSubscribed: false } : p)),
		);
	};

	/** Toggle subscription */
	const toggleSubscription = (podcastId: string) => {
		const podcast = podcasts().find((p) => p.id === podcastId);
		if (podcast?.isSubscribed) {
			unsubscribe(podcastId);
		} else {
			subscribe(podcastId);
		}
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
		toggleSubscription,
		refresh,
	};
}

/** Singleton discover store */
let discoverStoreInstance: ReturnType<typeof createDiscoverStore> | null = null;

export function useDiscoverStore() {
	if (!discoverStoreInstance) {
		discoverStoreInstance = createDiscoverStore();
	}
	return discoverStoreInstance;
}
