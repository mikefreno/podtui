/**
 * RSS feed client — single owner of feed XML fetches: headers, timeout,
 * and failure folding to null.
 */

/** Default per-feed fetch timeout (ms). */
export const FETCH_TIMEOUT_MS = 20_000;

/**
 * Fetch a feed's raw XML. Identity encoding keeps the response raw; the
 * Accept list matches what podcast servers send. Any failure (network,
 * non-ok, timeout) resolves to null — callers must leave data untouched.
 */
export const fetchFeedXml = async (
  url: string,
  opts?: { timeoutMs?: number },
): Promise<string | null> => {
  try {
    const response = await fetch(url, {
      headers: {
        "Accept-Encoding": "identity",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
};
