/**
 * Activity store for PodTUI
 *
 * Shared leak-proof activity counter: any store can surface "something is
 * loading/downloading" to the global top-right indicator. beginActivity
 * returns an end token that removes exactly THAT instance, so concurrent
 * overlapping activities compose correctly; prefer track() so callers
 * cannot strand the counter.
 */

import { createSignal } from "solid-js";

function createActivityStore() {
	const [count, setCount] = createSignal(0);
	const [labels, setLabels] = createSignal<string[]>([]);

	/** Begin a tracked activity and return its end function. Every begin
	 *  MUST be paired with exactly one call of the returned end (via the
	 *  token); prefer track() so the pairing is automatic. Duplicate labels
	 *  are allowed — each end removes exactly one instance (found by
	 *  indexOf). */
	const beginActivity = (label: string): (() => void) => {
		setLabels((prev) => [...prev, label]);
		setCount((c) => c + 1);
		let ended = false;
		return () => {
			if (ended) return;
			ended = true;
			setLabels((prev) => {
				const idx = prev.indexOf(label);
				if (idx === -1) return prev;
				const next = [...prev];
				next.splice(idx, 1);
				return next;
			});
			setCount((c) => Math.max(0, c - 1));
		};
	};

	/** Track a promise: begin an activity, auto-end when it settles, and
	 *  re-throw on rejection so the caller's error handling is untouched. */
	const track = async <T,>(p: Promise<T>, label: string): Promise<T> => {
		const end = beginActivity(label);
		try {
			return await p;
		} finally {
			end();
		}
	};

	/** True while at least one activity is in flight */
	const isActive = (): boolean => count() > 0;

	return {
		// State
		count,
		labels,
		// Actions
		beginActivity,
		track,
		// Getters
		isActive,
	};
}

let activityStoreInstance: ReturnType<typeof createActivityStore> | null = null;

export function useActivityStore() {
	if (!activityStoreInstance) {
		activityStoreInstance = createActivityStore();
	}
	return activityStoreInstance;
}
