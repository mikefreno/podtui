import { onCleanup } from "solid-js";
import { setupTerminalRecovery } from "./utils/terminal-recovery";
import { installNestedScrollBehavior } from "./utils/nested-scroll";
import type { Feed } from "./types/feed"
import type { Episode } from "./types/episode"

const VERSION = "0.7.2";

interface CliArgs {
	version: boolean;
	query: string | null;
	play: string | null;
}

function parseArgs(): CliArgs {
	const args = process.argv.slice(2);
	const result: CliArgs = {
		version: false,
		query: null,
		play: null,
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--version" || arg === "-v") {
			result.version = true;
		} else if (arg === "--query" || arg === "-q") {
			result.query = args[i + 1] || "";
			i++;
		} else if (arg === "--play" || arg === "-p") {
			result.play = args[i + 1] || "";
			i++;
		}
	}

	return result;
}

const cliArgs = parseArgs();

if (cliArgs.version) {
	console.log(`PodTUI version ${VERSION}`);
	process.exit(0);
}

// ── CLI handlers ──────────────────────────────────────────────────────

function findLatestEpisode(
	feeds: Feed[],
): { feed: Feed; episode: Episode } | null {
	let latest: { feed: Feed; episode: Episode } | null = null
	let latestDate = 0

	for (const feed of feeds) {
		if (feed.episodes.length === 0) continue
		const ep = feed.episodes[0]
		const epDate =
			ep.pubDate instanceof Date ? ep.pubDate.getTime() : Number(ep.pubDate)
		if (epDate > latestDate) {
			latestDate = epDate
			latest = { feed, episode: ep }
		}
	}

	return latest
}

/** Search feeds by title and print matching shows */
function handleQuery(feeds: Feed[], query: string): void {
	const normalizedQuery = query.toLowerCase()

	const matches = feeds.filter((feed) => {
		const title = feed.podcast.title.toLowerCase()
		return title.includes(normalizedQuery)
	})

	if (matches.length === 0) {
		console.log(`No shows found matching: ${query}`)
		if (feeds.length > 0) {
			console.log("\nAvailable shows:")
			feeds.slice(0, 5).forEach((feed) => {
				console.log(`  - ${feed.podcast.title}`)
			})
			if (feeds.length > 5) {
				console.log(`  ... and ${feeds.length - 5} more`)
			}
		}
		process.exit(0)
	}

	if (matches.length === 1) {
		const feed = matches[0]
		console.log(`\n${feed.podcast.title}`)
		if (feed.podcast.description) {
			console.log(
				feed.podcast.description.substring(0, 200) +
					(feed.podcast.description.length > 200 ? "..." : ""),
			)
		}
		console.log(`\nRecent episodes (${Math.min(5, feed.episodes.length)}):`)
		feed.episodes.slice(0, 5).forEach((ep, idx) => {
			const date =
				ep.pubDate instanceof Date
					? ep.pubDate.toLocaleDateString()
					: String(ep.pubDate)
			console.log(`  ${idx + 1}. ${ep.title} (${date})`)
		})
		process.exit(0)
	}

	console.log(`\nClosest matches for "${query}":`)
	matches.slice(0, 5).forEach((feed, idx) => {
		console.log(`  ${idx + 1}. ${feed.podcast.title}`)
	})
	process.exit(0)
}

/** Resolve and play an episode from `arg` (title path or "latest") */
async function handlePlay(feeds: Feed[], arg: string): Promise<void> {
	const normalizedArg = arg.toLowerCase()

	let feedResult: Feed | null = null
	let episodeResult: Episode | null = null

	if (normalizedArg === "latest") {
		const latest = findLatestEpisode(feeds)
		if (latest) {
			feedResult = latest.feed
			episodeResult = latest.episode
		}
	} else {
		const parts = normalizedArg.split("/")
		const showQuery = parts[0]
		const episodeQuery = parts[1]

		const matchingFeeds = feeds.filter((feed) =>
			feed.podcast.title.toLowerCase().includes(showQuery),
		)

		if (matchingFeeds.length === 0) {
			console.log(`No show found matching: ${showQuery}`)
			process.exit(1)
		}

		const feed = matchingFeeds[0]

		if (!episodeQuery) {
			if (feed.episodes.length > 0) {
				feedResult = feed
				episodeResult = feed.episodes[0]
			} else {
				console.log(`No episodes available for: ${feed.podcast.title}`)
				process.exit(1)
			}
		} else if (episodeQuery === "latest") {
			feedResult = feed
			episodeResult = feed.episodes[0]
		} else {
			const matchingEpisode = feed.episodes.find((ep) =>
				ep.title.toLowerCase().includes(episodeQuery),
			)

			if (matchingEpisode) {
				feedResult = feed
				episodeResult = matchingEpisode
			} else {
				console.log(`Episode not found: ${episodeQuery}`)
				console.log(`Available episodes for ${feed.podcast.title}:`)
				feed.episodes.slice(0, 5).forEach((ep, idx) => {
					console.log(`  ${idx + 1}. ${ep.title}`)
				})
				process.exit(1)
			}
		}
	}

	if (!feedResult || !episodeResult) {
		console.log("Could not find episode to play")
		process.exit(1)
	}

	console.log(`\nPlaying: ${episodeResult.title}`)
	console.log(`Show: ${feedResult.podcast.title}`)

	try {
		const { createAudioBackend } = await import("./utils/audio-player")
		const { fetchCoverArt } = await import("./utils/cover-art")
		const backend = createAudioBackend()
		if (episodeResult.audioUrl) {
			// Stage the podcast cover so the system Now Playing shows
			// artwork (mpv --cover-art-files), like the UI path does. Falls
			// back to the episode's own image when the feed has no channel
			// cover (URL-added feeds).
			const coverUrl =
				feedResult.podcast.coverUrl ?? episodeResult.imageUrl;
			const coverArtPath = coverUrl
				? await fetchCoverArt(coverUrl)
				: null
			await backend.play(episodeResult.audioUrl, {
				mediaTitle: episodeResult.title,
				coverArtPath: coverArtPath ?? undefined,
			})
			console.log("Playback started (use the UI to control)")
		} else {
			console.log("No audio URL available for this episode")
			process.exit(1)
		}
	} catch (err) {
		console.error("Playback error:", err)
		process.exit(1)
	}
}

if (cliArgs.query !== null || cliArgs.play !== null) {
	import("./utils/feeds-persistence")
		.then(async ({ loadFeedsFromFile }) => {
			const feeds = await loadFeedsFromFile();

			if (cliArgs.query !== null) {
				handleQuery(feeds, cliArgs.query)
			}

			if (cliArgs.play !== null) {
				await handlePlay(feeds, cliArgs.play)
			}
		})
		.catch((err) => {
			console.error("Error:", err);
			process.exit(1);
		});
} else {
	import("@opentui/solid").then(async ({ render, useRenderer }) => {
		const { App } = await import("./App");
		const { ThemeProvider } = await import("./context/ThemeContext");
		const toast = await import("./ui/toast");
		const { KeybindProvider } = await import("./context/KeybindContext");
		const { NavigationProvider } = await import("./context/NavigationContext");
		const { DialogProvider } = await import("./ui/dialog");
		const { CommandProvider } = await import("./ui/command");
		// Nested scroll sections favor the innermost one under the cursor.
		installNestedScrollBehavior();

		function RendererSetup(props: { children: unknown }) {
			const renderer = useRenderer();
			renderer.disableStdoutInterception();
			onCleanup(setupTerminalRecovery(renderer));
			return props.children;
		}

		render(
			() => (
				<RendererSetup>
					<toast.ToastProvider>
						<ThemeProvider mode="dark">
							<KeybindProvider>
								<NavigationProvider>
									<DialogProvider>
										<CommandProvider>
											<App />
											<toast.Toast />
										</CommandProvider>
									</DialogProvider>
								</NavigationProvider>
							</KeybindProvider>
						</ThemeProvider>
					</toast.ToastProvider>
				</RendererSetup>
			),
			{ useThread: false },
		);
	});
}
