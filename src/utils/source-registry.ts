/**
 * Source registry — owns the podcast source list and its immediate file
 * persistence. The feed store seeds it at boot and wires the loaded list in.
 */

import { createSignal } from "solid-js";
import type { PodcastSource } from "../types/source";
import { saveSourcesToFile } from "./feeds-persistence";

/** Create a source registry around the given initial list. Every mutation
 *  persists immediately (async, fire-and-forget) — source edits are rare
 *  and must not sit in a debounce window across a process exit. */
export function createSourceRegistry(initial: PodcastSource[]) {
	const [sources, setSources] = createSignal<PodcastSource[]>([...initial]);

	/** Swap in a fully rebuilt list WITHOUT persisting — the boot-time
	 *  loader saves only when its migration actually changed data. */
	const replaceAll = (list: PodcastSource[]): void => {
		setSources(list);
	};

	const addSource = (source: Omit<PodcastSource, "id">): PodcastSource => {
		const newSource: PodcastSource = {
			...source,
			id: crypto.randomUUID(),
		};
		setSources((prev) => {
			const updated = [...prev, newSource];
			saveSourcesToFile(updated);
			return updated;
		});
		return newSource;
	};

	const updateSource = (
		sourceId: string,
		updates: Partial<PodcastSource>,
	): void => {
		setSources((prev) => {
			const updated = prev.map((source) =>
				source.id === sourceId ? { ...source, ...updates } : source,
			);
			saveSourcesToFile(updated);
			return updated;
		});
	};

	const toggleSource = (sourceId: string): void => {
		setSources((prev) => {
			const updated = prev.map((s) =>
				s.id === sourceId ? { ...s, enabled: !s.enabled } : s,
			);
			saveSourcesToFile(updated);
			return updated;
		});
	};

	return { sources, replaceAll, addSource, updateSource, toggleSource };
}
