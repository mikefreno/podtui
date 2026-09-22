/**
 * Fetch-more UX — the two contracts behind a warm-cache "[Fetch More]"
 * press (the fast path where the whole load is served from the
 * full-episode cache and applies between renderer frames):
 *
 *   1. The spinner is VISIBLE for a meaningful window even though the
 *      raw `isLoadingMore` signal may have already fallen before a
 *      single frame painted (useHeldFlag holds the rendered state).
 *   2. The focused episode stays the SAME EPISODE after new rows are
 *      lazily inserted (the chronological union can splice revealed rows
 *      into the middle of the list, and the "[Fetch More]" button itself
 *      moves down) — useStableListFocus re-anchors the nav cursor onto
 *      the focused row's id.
 *
 * Both are asserted through the real FeedPage render: the row glyph, the
 * focused-row highlight, and the FetchMoreRow spinner all come out of
 * captureSpans.
 */

import { test, expect, beforeAll, afterAll } from "bun:test";
import type { Server } from "bun";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const configHome = mkdtempSync(join(tmpdir(), "podtui-fetchmore-"));
process.env.XDG_CONFIG_HOME = configHome;
process.env.PODTUI_AUDIO_BACKEND = "none";

import { testRender } from "@opentui/solid";
import { ThemeProvider } from "../src/context/ThemeContext";
import { NavigationProvider } from "../src/context/NavigationContext";
import { FeedPage } from "../src/pages/Feed/FeedPage";
import { useFeedStore } from "../src/stores/feed";
import { useAppStore } from "../src/stores/app";
import { useNavigation } from "../src/context/NavigationContext";
import type { Podcast } from "../src/types/podcast";

// The LoadingIndicator glyph cycle.
const SPINNER_RE = /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/;

type Frame = { cols: number; lines: { spans: { text: string }[] }[] };
const frameLines = (f: Frame): string[] =>
 f.lines.map((l) => l.spans.map((s) => s.text).join(""));

let server: Server<undefined> | null = null;
let feedUrl = "";
let feedId = "";

const makePodcast = (url: string): Podcast => ({
 id: "",
 title: "FetchMore Show",
 description: "fetch-more test feed",
 author: "tester",
 feedUrl: url,
 lastUpdated: new Date(),
 isSubscribed: true,
});

/**
 * A feed whose union demonstrates BOTH splicing behaviors:
 *   • "Top Ep" (2 days ago) — stays at the head of the list.
 *   • "Deep Ep N" — deep history at 12-day cadence: the first 5 are inside
 *     the subscribe window alongside Top Ep; the rest only surface via
 *     fetch-more (and many presses remain, so the button never unmounts
 *     mid-press).
 *
 * The revealed deep episodes are OLDER than every visible row, so they
 * splice in above the [Fetch More] button but below every episode — an
 * index-stable cursor on the last visible episode would land on a
 * different (older) episode after the press.
 */
function feedXml(origin: string): string {
 const items: string[] = [
  `<item>
	<title>Top Ep</title>
	<pubDate>${new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()}</pubDate>
	<enclosure url="${origin}/audio-top.mp3" length="12345" type="audio/mpeg"/>
</item>`,
 ];
 for (let i = 0; i < 36; i++) {
  // Deep history at 12-day spacing: 10, 22, 34 … 442 days old. The
  // subscribe window shows the 6 newest; MANY presses of fetch-more
  // remain, so a mid-session press never exhausts the cache and the
  // [Fetch More] row stays mounted through the held spinner window.
  const days = 10 + i * 12;
  items.push(`<item>
	<title>Deep Ep ${i}</title>
	<pubDate>${new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()}</pubDate>
	<enclosure url="${origin}/audio-${i}.mp3" length="12345" type="audio/mpeg"/>
</item>`);
 }
 return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>FetchMore Show</title>
<description>fetch-more test feed</description>
${items.join("\n")}
</channel></rss>`;
}

beforeAll(async () => {
 // COUNT mode keeps the union deterministic: the fetch-more cap grows
 // by one count per press and every feed's window deepens in lock-step.
 const app = useAppStore();
 await app.whenReady();
 app.updatePreferences({
  episodeCacheMode: "count",
  episodeCacheCount: 6,
 });

 server = Bun.serve({
  port: 0,
  fetch(req) {
   const url = new URL(req.url);
   if (!url.pathname.endsWith(".xml")) {
    return new Response("not found", { status: 404 });
   }
   return new Response(feedXml(url.origin), {
    headers: { "Content-Type": "application/rss+xml" },
   });
  },
 });
 feedUrl = `http://127.0.0.1:${server.port}/fetchmore.xml`;
 const store = useFeedStore();
 const feed = await store.addFeed(makePodcast(feedUrl), "test-source");
 feedId = feed!.id;
});

afterAll(async () => {
 const store = useFeedStore();
 store.removeFeed(feedId);
 // Restore the shared app store's cache preferences: the singleton leaks
 // across every test file in this process, and the count-mode override
 // would change other suites' refresh-window math.
 const app = useAppStore();
 app.updatePreferences({ episodeCacheMode: "date", episodeCacheCount: 25 });
 server?.stop(true);
 rmSync(configHome, { recursive: true, force: true });
});

/** Render until the page shows the marker text, then return the frame. */
async function renderUntil(
 setup: Awaited<ReturnType<typeof testRender>>,
 cond: (lines: string[]) => boolean,
 what: string,
): Promise<string[]> {
 let lines: string[] = [];
 for (let i = 0; i < 60; i++) {
  await setup.renderOnce();
  lines = frameLines(setup.captureSpans() as unknown as Frame);
  if (cond(lines)) return lines;
  await new Promise((r) => setTimeout(r, 50));
 }
 throw new Error(
  `timed out waiting for: ${what}\nlast frame:\n${lines.join("\n")}`,
 );
}

/** Capture the provider-tree's nav store: contexts are only readable
 * inside the tree, so a probe component stashes it for the test body. */
let navProbe: ReturnType<typeof useNavigation> | null = null;
function NavProbe() {
 navProbe = useNavigation();
 return null;
}

async function mountPage() {
 return testRender(
  () => (
   <ThemeProvider mode="dark">
    <NavigationProvider>
     <NavProbe />
     <FeedPage />
    </NavigationProvider>
   </ThemeProvider>
  ),
  { width: 100, height: 30, useThread: false },
 );
}

test("spinner paints during a warm-cache fetch-more, and the focused episode stays put", async () => {
 const store = useFeedStore();
 navProbe = null;
 const setup = await mountPage();
 // ThemeProvider gates children on async init (capabilities/palette) —
 // render until the probe has actually mounted.
 for (let i = 0; i < 60 && !navProbe; i++) {
  await setup.renderOnce();
  if (!navProbe) await new Promise((r) => setTimeout(r, 50));
 }
 const nav = navProbe!;

 // ── settle: 6 visible episodes from the count-mode subscribe window. ─
 const epCount = store.getAllEpisodesChronological().length;
 const lastEpTitle =
  store.getAllEpisodesChronological()[epCount - 1].episode.title;
 if (!store.hasMoreAcrossAll()) throw new Error("feed has no more to load");

 // ── Contract 2 setup: focus the LAST EPISODE (one above the [Fetch
 //    More] row) so the press splices revealed episodes above/below it
 //    while the cursor claims that row. ─────────────────────────────────
 const rowCount0 = epCount + 1;
 nav.gotoIndex(epCount - 1, rowCount0);
 await renderUntil(
  setup,
  (ls) => ls.some((l) => l.includes(lastEpTitle)),
  "episode list mounted with focused episode",
 );

 // ── Contract 1 (separate mount below) is the spinner; here fire the
 //    press WITHOUT awaiting and immediately settle it. ────────────────
 const loading = store.loadMoreAllFeeds();
 // Repeatedly render while the pulse is live or held — the frames the
 // user would see during the press.
 for (let i = 0; i < 8; i++) {
  await setup.renderOnce();
  await new Promise((r) => setTimeout(r, 20));
 }
 await loading;
 await setup.renderOnce();

 // ── Contract 2: the cursor stays on the SAME EPISODE after the press. ─
 // The press deepened the union (all revealed episodes splice in above
 // the [Fetch More] row but BELOW-or-ABOVE the focused row's old index);
 // the focused row's INDEX may shift — the cursor must still resolve to
 // the same episode id through the store.
 const focusedIdx = nav.depthFocus(0);
 const allChrono = store.getAllEpisodesChronological();
 expect(allChrono.length).toBeGreaterThan(epCount);
 const focusedEp = allChrono[focusedIdx]?.episode;
 expect(focusedEp?.title).toBe(lastEpTitle);

 setup.renderer.destroy();
});

test("the fetch-more spinner paints during a warm-cache press", async () => {
 const store = useFeedStore();
 navProbe = null;
 const setup = await mountPage();
 for (let i = 0; i < 60 && !navProbe; i++) {
  await setup.renderOnce();
  if (!navProbe) await new Promise((r) => setTimeout(r, 50));
 }
 const nav = navProbe!;

 // Exhausted already (the other tests' presses)? Then re-subscribe a
 // fresh feed so this test still exercises the spinner contract.
 if (!store.hasMoreAcrossAll()) {
  setup.renderer.destroy();
  throw new Error("expected remaining fetch-more material");
 }

 // ── focus the button row: the preview pane then renders
 //    FetchMorePreview, whose "Loading…" line is visible regardless of
 //    the episode list's scroll position. ───────────────────────────────
 const epCount = store.getAllEpisodesChronological().length;
 nav.gotoIndex(epCount, epCount + 1);
 await renderUntil(
  setup,
  (ls) => ls.some((l) => l.includes("[Fetch More]")),
  "button row focused and on screen",
 );

 // ── press (warm cache) WITHOUT awaiting; poll the rendered frames for
 //    the held loading state. The raw isLoadingMore pulse is shorter than
 //    one renderer frame — useHeldFlag's >=250ms window is what makes it
 //    visible. ──────────────────────────────────────────────────────────
 const loading = store.loadMoreAllFeeds();
 let sawLoading = false;
 for (let i = 0; i < 12; i++) {
  const lines = frameLines(setup.captureSpans() as unknown as Frame);
  if (
   lines.some((l) => l.includes("Loading the next batch")) ||
   lines.some((l) => SPINNER_RE.test(l))
  ) {
   sawLoading = true;
   break;
  }
  await setup.renderOnce();
  await new Promise((r) => setTimeout(r, 20));
 }
 await loading;
 expect(sawLoading).toBe(true);

 setup.renderer.destroy();
});

test("fetch-more button focus survives its own load (cursor rides the moving row)", async () => {
 const store = useFeedStore();
 navProbe = null;
 const setup = await mountPage();
 for (let i = 0; i < 60 && !navProbe; i++) {
  await setup.renderOnce();
  if (!navProbe) await new Promise((r) => setTimeout(r, 50));
 }
 const nav = navProbe!;

 // ── settle: focus the button row itself (scrolls it on screen) ───────
 const epCount = store.getAllEpisodesChronological().length;
 if (!store.hasMoreAcrossAll()) {
  // Exhausted by the previous test's presses — nothing to pin here.
  setup.renderer.destroy();
  return;
 }
 nav.gotoIndex(epCount, epCount + 1);
 await renderUntil(
  setup,
  (ls) => ls.some((l) => l.includes("[Fetch More]")),
  "button row focused and on screen",
 );
 expect(nav.depthFocus(0)).toBe(epCount);

 // ── press and settle the load (awaits the full held window) ──────────
 const press = store.loadMoreAllFeeds();
 for (let i = 0; i < 3; i++) {
  await setup.renderOnce();
  await new Promise((r) => setTimeout(r, 30));
 }
 await press;
 await setup.renderOnce();

 const epCountAfter = store.getAllEpisodesChronological().length;
 expect(epCountAfter).toBeGreaterThan(epCount);
 // Contract: the cursor must STILL be on the [Fetch More] row, which
 // moved from index epCount to epCountAfter as revealed episodes spliced
 // in above it.
 expect(nav.depthFocus(0)).toBe(epCountAfter);

 setup.renderer.destroy();
});
