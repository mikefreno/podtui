/**
 * Cover-art staging for the system Now Playing session.
 *
 * macOS shows the media session's albumart in the audio center (Control
 * Center / lock screen). mpv reads it from `--cover-art-files` (loads the
 * file as an albumart video track), so the podcast cover is staged to a temp
 * file BEFORE playback starts and passed to mpv.
 *
 * Downloaded via `curl` (not `fetch`): Bun's `fetch` hangs in compiled
 * `bun build --compile` binaries (Bun 1.3.8), timing out on any host —
 * which would silently drop every cover in shipped builds. curl is present
 * on macOS and Linux. Bounded: a slow cover server must never stall audio,
 * so an 8s cap drops the art.
 */

import { tmpdir } from "os";
import { join } from "path";
import { unlinkSync, statSync } from "fs";

export const coverTempPath = () => join(tmpdir(), "podtui-cover.jpg");

export async function fetchCoverArt(url: string): Promise<string | null> {
	const path = coverTempPath();
	try {
		unlinkSync(path);
	} catch {
		/* no stale cover */
	}
	try {
		return await Promise.race([
			(async () => {
				const proc = Bun.spawn([
					"curl",
					"-sS",
					"--fail",
					"-m",
					"8",
					"--max-filesize",
					"2097152",
					"-o",
					path,
					url,
				]);
				const code = await proc.exited;
				if (code !== 0) return null;
				try {
					return statSync(path).size > 0 ? path : null;
				} catch {
					return null;
				}
			})(),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
		]);
	} catch {
		return null;
	}
}
