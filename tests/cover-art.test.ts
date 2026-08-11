/**
 * Cover-art disk-cache contract tests.
 *
 * fetchCoverArt downloads each cover ONCE into a persistent per-URL cache;
 * playback never waits on the network for art it has already fetched. Pins:
 *
 * 1. A fetch stores the bytes on disk and returns the cache path.
 * 2. A second fetch of the same URL returns the cached path WITHOUT hitting
 *    the server again (request count stays 1).
 * 3. Concurrent fetches of the same URL share one download (single-flight).
 * 4. A failed fetch (404) resolves null instead of throwing.
 *
 * Served from a local Bun server — no external network dependence. Cache
 * entries created here are removed afterwards.
 */
import { test, expect } from "bun:test";
import { unlinkSync } from "fs";
import { cachedCoverPath, fetchCoverArt } from "../src/utils/cover-art";

const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(256).fill(7)]);

test("cover art is fetched once, cached on disk, and shared", async () => {
	let requests = 0;
	const server = Bun.serve({
		port: 0,
		fetch(req) {
			requests++;
			if (new URL(req.url).pathname === "/missing.jpg") {
				return new Response("nope", { status: 404 });
			}
			return new Response(FAKE_JPEG, {
				headers: { "content-type": "image/jpeg" },
			});
		},
	});

	const url = `http://127.0.0.1:${server.port}/cover.jpg`;
	const missing = `http://127.0.0.1:${server.port}/missing.jpg`;
	let cachedPath: string | null = null;
	try {
		expect(cachedCoverPath(url)).toBeNull();

		// First fetch: downloads and caches.
		cachedPath = await fetchCoverArt(url);
		expect(cachedPath).not.toBeNull();
		expect(requests).toBe(1);
		expect(Bun.file(cachedPath!).size).toBe(FAKE_JPEG.byteLength);

		// Second fetch: disk hit, server untouched.
		expect(await fetchCoverArt(url)).toBe(cachedPath);
		expect(requests).toBe(1);

		// Single-flight: parallel misses of a fresh URL make ONE request.
		const shared = `http://127.0.0.1:${server.port}/shared.jpg`;
		const [a, b, c] = await Promise.all([
			fetchCoverArt(shared),
			fetchCoverArt(shared),
			fetchCoverArt(shared),
		]);
		expect(a).not.toBeNull();
		expect(a).toBe(b);
		expect(b).toBe(c);
		if (a) unlinkSync(a);

		// 404 resolves null, never throws.
		expect(await fetchCoverArt(missing)).toBeNull();
	} finally {
		server.stop(true);
		if (cachedPath) {
			try {
				unlinkSync(cachedPath);
			} catch {
				/* ignore */
			}
		}
	}
});
