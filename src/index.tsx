const VERSION = "0.2.1";

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

if (cliArgs.query !== null || cliArgs.play !== null) {
	import("./utils/feeds-persistence")
		.then(async ({ loadFeedsFromFile }) => {
			const feeds = await loadFeedsFromFile();

			if (cliArgs.query !== null) {
				const query = cliArgs.query;
				const normalizedQuery = query.toLowerCase();

				const matches = feeds.filter((feed) => {
					const title = feed.podcast.title.toLowerCase();
					return title.includes(normalizedQuery);
				});

				if (matches.length === 0) {
					console.log(`No shows found matching: ${query}`);
					if (feeds.length > 0) {
						console.log("\nAvailable shows:");
						feeds.slice(0, 5).forEach((feed) => {
							console.log(`  - ${feed.podcast.title}`);
						});
						if (feeds.length > 5) {
							console.log(`  ... and ${feeds.length - 5} more`);
						}
					}
					process.exit(0);
				}

				if (matches.length === 1) {
					const feed = matches[0];
					console.log(`\n${feed.podcast.title}`);
					if (feed.podcast.description) {
						console.log(
							feed.podcast.description.substring(0, 200) +
								(feed.podcast.description.length > 200 ? "..." : ""),
						);
					}
					console.log(
						`\nRecent episodes (${Math.min(5, feed.episodes.length)}):`,
					);
					feed.episodes.slice(0, 5).forEach((ep, idx) => {
						const date =
							ep.pubDate instanceof Date
								? ep.pubDate.toLocaleDateString()
								: String(ep.pubDate);
						console.log(`  ${idx + 1}. ${ep.title} (${date})`);
					});
					process.exit(0);
				}

				console.log(`\nClosest matches for "${query}":`);
				matches.slice(0, 5).forEach((feed, idx) => {
					console.log(`  ${idx + 1}. ${feed.podcast.title}`);
				});
				process.exit(0);
			}

			if (cliArgs.play !== null) {
				const playArg = cliArgs.play;
				const normalizedArg = playArg.toLowerCase();

				let feedResult: (typeof feeds)[0] | null = null;
				let episodeResult: (typeof feeds)[0]["episodes"][0] | null = null;

				if (normalizedArg === "latest") {
					let latestFeed: (typeof feeds)[0] | null = null;
					let latestEpisode: (typeof feeds)[0]["episodes"][0] | null = null;
					let latestDate = 0;

					for (const feed of feeds) {
						if (feed.episodes.length > 0) {
							const ep = feed.episodes[0];
							const epDate =
								ep.pubDate instanceof Date
									? ep.pubDate.getTime()
									: Number(ep.pubDate);
							if (epDate > latestDate) {
								latestDate = epDate;
								latestFeed = feed;
								latestEpisode = ep;
							}
						}
					}

					feedResult = latestFeed;
					episodeResult = latestEpisode;
				} else {
					const parts = normalizedArg.split("/");
					const showQuery = parts[0];
					const episodeQuery = parts[1];

					const matchingFeeds = feeds.filter((feed) =>
						feed.podcast.title.toLowerCase().includes(showQuery),
					);

					if (matchingFeeds.length === 0) {
						console.log(`No show found matching: ${showQuery}`);
						process.exit(1);
					}

					const feed = matchingFeeds[0];

					if (!episodeQuery) {
						if (feed.episodes.length > 0) {
							feedResult = feed;
							episodeResult = feed.episodes[0];
						} else {
							console.log(`No episodes available for: ${feed.podcast.title}`);
							process.exit(1);
						}
					} else if (episodeQuery === "latest") {
						feedResult = feed;
						episodeResult = feed.episodes[0];
					} else {
						const matchingEpisode = feed.episodes.find((ep) =>
							ep.title.toLowerCase().includes(episodeQuery),
						);

						if (matchingEpisode) {
							feedResult = feed;
							episodeResult = matchingEpisode;
						} else {
							console.log(`Episode not found: ${episodeQuery}`);
							console.log(`Available episodes for ${feed.podcast.title}:`);
							feed.episodes.slice(0, 5).forEach((ep, idx) => {
								console.log(`  ${idx + 1}. ${ep.title}`);
							});
							process.exit(1);
						}
					}
				}

				if (!feedResult || !episodeResult) {
					console.log("Could not find episode to play");
					process.exit(1);
				}

				console.log(`\nPlaying: ${episodeResult.title}`);
				console.log(`Show: ${feedResult.podcast.title}`);

				try {
					const { createAudioBackend } = await import("./utils/audio-player");
					const backend = createAudioBackend();
					if (episodeResult.audioUrl) {
						await backend.play(episodeResult.audioUrl);
						console.log("Playback started (use the UI to control)");
					} else {
						console.log("No audio URL available for this episode");
						process.exit(1);
					}
				} catch (err) {
					console.error("Playback error:", err);
					process.exit(1);
				}
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

		function RendererSetup(props: { children: unknown }) {
			const renderer = useRenderer();
			renderer.disableStdoutInterception();
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
