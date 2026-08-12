import { Show } from "solid-js";
import { useFeedStore } from "@/stores/feed";
import { useSearchStore } from "@/stores/search";
import { useDownloadStore } from "@/stores/download";
import { useActivityStore } from "@/stores/activity";
import { LoadingIndicator } from "@/components/LoadingIndicator";

/**
 * GlobalActivityIndicator — one global top-right signal that ANY feed
 * refresh, fetch-more, subscribe fetch, search, or download is in flight.
 * Per-page spinners are unchanged; this overlays the content row and status
 * bar as a single app-wide "something is happening" indicator.
 */
export function GlobalActivityIndicator() {
  const feedStore = useFeedStore();
  const searchStore = useSearchStore();
  const downloadStore = useDownloadStore();
  const activity = useActivityStore();

  /** True while any tracked activity is in flight */
  const isActive = () =>
    feedStore.isLoadingFeeds() ||
    feedStore.isLoadingMore() ||
    searchStore.isSearching() ||
    downloadStore.getActiveCount() + downloadStore.getQueue().length > 0 ||
    activity.isActive();

  /** Label priority: downloads in flight > latest tracked activity >
   *  generic loading (only reachable when an isLoading/isSearching flag is
   *  on but nothing else is). */
  const label = () => {
    const activeCount = downloadStore.getActiveCount();
    const queueLength = downloadStore.getQueue().length;
    if (activeCount + queueLength > 0) {
      return `Downloading ${activeCount}${
        queueLength > 0 ? ` +${queueLength} queued` : ""
      }`;
    }
    if (activity.isActive()) {
      const latest = activity.labels().at(-1);
      return `${latest ?? "Loading"}…`;
    }
    return "Loading…";
  };

  return (
    <Show when={isActive()}>
      <box position="absolute" top={0} right={0} paddingRight={1}>
        <LoadingIndicator label={label()} />
      </box>
    </Show>
  );
}
