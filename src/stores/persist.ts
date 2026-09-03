/**
 * Persistence scheduler for PodTUI
 * Per-domain trailing-edge debounced writes
 */

/** Debounced writer: rapid schedules collapse into one write per domain. */
export interface PersistScheduler {
	/** Mark a domain dirty and (re)arm its trailing-edge write timer. */
	schedule(domain: string): void;
	/** Write the domain immediately if dirty; cancels any pending timer. */
	flush(domain: string): void;
	/** Write every dirty domain immediately. */
	flushAll(): void;
}

/** Timer handle as returned by setTimeout in this runtime. */
type TimerHandle = ReturnType<typeof setTimeout>;

/** Build a per-domain trailing-edge debouncer. `write` is invoked with the
 *  domain name; callers read current state inside it, so a flush always
 *  lands the latest value. Rapid schedule() calls share one timer. */
export function createPersistScheduler(
	write: (domain: string) => void,
	debounceMs = 250,
): PersistScheduler {
	const dirty = new Set<string>();
	const timers = new Map<string, TimerHandle>();

	const flush = (domain: string): void => {
		const timer = timers.get(domain);
		if (timer) {
			clearTimeout(timer);
			timers.delete(domain);
		}
		if (!dirty.has(domain)) return;
		dirty.delete(domain);
		write(domain);
	};

	const schedule = (domain: string): void => {
		dirty.add(domain);
		clearTimeout(timers.get(domain));
		timers.set(
			domain,
			setTimeout(() => {
				timers.delete(domain);
				flush(domain);
			}, debounceMs),
		);
	};

	const flushAll = (): void => {
		for (const domain of [...dirty]) flush(domain);
	};

	return { schedule, flush, flushAll };
}
