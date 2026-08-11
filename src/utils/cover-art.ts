/**
 * Cover-art staging for the system Now Playing session.
 *
 * macOS shows the media session's albumart in the audio center (Control
 * Center / lock screen). mpv reads artwork from `--cover-art-files` (loads
 * the file as an albumart video track), so the podcast cover must exist on
 * disk before (cover-art-files) or right after (video-add) playback starts.
 *
 * Covers are cached persistently under `$XDG_CACHE_HOME/podtui/covers`
 * (~/.cache/podtui/covers by default), keyed by the URL hash, so the
 * download happens ONCE per feed — subsequent plays (including the
 * boot-restored episode) hit the disk cache and never wait on the network.
 * The play path must never block on art: `cachedCoverPath` is the sync
 * fast path; `fetchCoverArt` is awaited only by flows where latency does
 * not matter (CLI play) or fired in the background with the result
 * applied to a live mpv via `video-add`.
 *
 * Downloaded via `curl` (not `fetch`): Bun's `fetch` hangs in compiled
 * `bun build --compile` binaries (Bun 1.3.8), timing out on any host —
 * which would silently drop every cover in shipped builds. curl is present
 * on macOS and Linux. Bounded: a slow cover server must never stall audio.
 */

import { existsSync, mkdirSync, renameSync, statSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";

/** Resolved once per process; null when no home directory is detectable. */
let cacheDir: string | null | undefined;

function coversDir(): string | null {
	if (cacheDir !== undefined) return cacheDir;
	let dir: string | null = null;
	try {
		const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
		if (home) {
			dir = join(process.env.XDG_CACHE_HOME ?? join(home, ".cache"), "podtui", "covers");
			mkdirSync(dir, { recursive: true });
		}
	} catch {
		dir = null;
	}
	cacheDir = dir;
	return dir;
}

function cachePathFor(url: string): string | null {
	const dir = coversDir();
	if (!dir) return null;
	return join(dir, `${createHash("sha1").update(url).digest("hex")}.jpg`);
}

/**
 * Sync fast path: the cached cover file for `url`, or null when it has not
 * been downloaded yet. This is what keeps cover art off the play() critical
 * path — a cache hit costs one stat() and a miss simply plays without art
 * (or applies it late via video-add).
 */
export function cachedCoverPath(url: string): string | null {
	const path = cachePathFor(url);
	if (!path) return null;
	try {
		return existsSync(path) && statSync(path).size > 0 ? path : null;
	} catch {
		return null;
	}
}

/** In-flight downloads keyed by URL — a burst of plays of the same show
 *  shares one curl instead of racing ephemeral files. */
const inflight = new Map<string, Promise<string | null>>();

/**
 * Fetch the cover for `url`, returns its cache path. Cache hits return
 * immediately. Downloads are single-flight per URL and time-bounded (8s);
 * failure resolves null and retries on the next call. The file is written
 * to a temp name and renamed into place so a killed process can never
 * poison the cache with a truncated file.
 */
export function fetchCoverArt(url: string): Promise<string | null> {
	const cached = cachedCoverPath(url);
	if (cached) return Promise.resolve(cached);

	const dest = cachePathFor(url);
	if (!dest) return Promise.resolve(null);

	const pending = inflight.get(url);
	if (pending) return pending;

	const task = (async (): Promise<string | null> => {
		const staging = `${dest}.${process.pid}.tmp`;
		try {
			const { promise, resolve } = Promise.withResolvers<string | null>();
			const proc = Bun.spawn(
				[
					"curl",
					"-sS",
					"--fail",
					"-m",
					"8",
					"--max-filesize",
					"2097152",
					"-o",
					staging,
					url,
				],
				{ stdout: "ignore", stderr: "ignore", stdin: "ignore" },
			);
			proc.exited
				.then((code) => {
					if (code !== 0) return resolve(null);
					try {
						if (statSync(staging).size <= 0) return resolve(null);
						renameSync(staging, dest);
						resolve(dest);
					} catch {
						resolve(null);
					}
				})
				.catch(() => resolve(null));
			setTimeout(() => resolve(null), 8000);
			return await promise;
		} finally {
			inflight.delete(url);
			// Best-effort staging cleanup (no-op after a successful rename).
			try {
				Bun.spawn(["rm", "-f", staging], { stdout: "ignore", stderr: "ignore" });
			} catch {
				/* ignore */
			}
		}
	})();

	inflight.set(url, task);
	return task;
}

/** Fire-and-forget warm-up used by the boot/restore path. */
export function prefetchCoverArt(url: string): void {
	fetchCoverArt(url).catch(() => {});
}
