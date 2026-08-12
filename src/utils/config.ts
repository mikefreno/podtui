/**
 * Centralized PodTui configuration — a single `config.json` holding every
 * user-facing bit needed to migrate to a new machine by copying one file.
 *
 * Contains: settings, preferences, custom theme, feeds (subscriptions), and
 * sources (podcast search/RSS sources).
 *
 * Runtime state that changes on every playback action (progress, downloads,
 * audio-nav) stays in separate files to avoid rewriting this file on every
 * seek. Keybinds remain in `keybinds.jsonc` (user-editable JSONC).
 *
 * Writes are serialized to avoid concurrent read-modify-write races, and
 * always overwrite — no backup files are created.
 */

import { mkdir } from "fs/promises";
import { ensureConfigDir, getConfigDir, getConfigFilePath } from "./config-dir";
import type {
	AppSettings,
	UserPreferences,
	ThemeColors,
} from "../types/settings";
import type { Feed } from "../types/feed";
import type { PodcastSource } from "../types/source";

/** Everything a user needs to migrate, in one file. */
export interface PodTuiConfig {
	settings?: AppSettings;
	preferences?: UserPreferences;
	customTheme?: ThemeColors;
	feeds?: Feed[];
	sources?: PodcastSource[];
}

const CONFIG_FILE = "config.json";

/** Legacy per-section files, migrated into config.json on first load. */
const LEGACY_FILES = ["app-state.json", "feeds.json", "sources.json"] as const;

/** Load the full config from disk. Returns {} if missing or corrupt.
 *  Runs one-time legacy migration on first call. */
export async function loadConfig(): Promise<PodTuiConfig> {
	await migrateOnce();
	try {
		const file = Bun.file(getConfigFilePath(CONFIG_FILE));
		if (!(await file.exists())) return {};
		const raw = await file.json();
		if (!raw || typeof raw !== "object") return {};
		return raw as PodTuiConfig;
	} catch {
		return {};
	}
}

// ── Write serialization ────────────────────────────────────────────────────
// A simple promise chain ensures reads-modify-writes execute sequentially so
// two concurrent saves can't clobber each other's sections.
let writeChain: Promise<void> = Promise.resolve();

/** Update sections of config.json (read-modify-write, serialized, overwrite). */
export function updateConfig(patch: Partial<PodTuiConfig>): void {
	// Capture the target path AND the patch data eagerly, at call time:
	// the write chain defers execution, and both the config dir (tests
	// re-point XDG_CONFIG_HOME between ops) and the state object (stores
	// mutate in place) move under a pending write. Without the capture, a
	// queued save writes the LATEST state into whatever directory is
	// current when the chain drains — a cross-directory misdelivery that
	// was the source of a flaky "enabled:false survives reload" test.
	const configPath = getConfigFilePath(CONFIG_FILE);
	const configDir = getConfigDir();
	const snapshot = JSON.parse(JSON.stringify(patch)) as Partial<PodTuiConfig>;
	writeChain = writeChain.then(async () => {
		try {
			await migrateOnce();
			await mkdir(configDir, { recursive: true });
			let current: PodTuiConfig = {};
			try {
				const file = Bun.file(configPath);
				if (await file.exists()) {
					const raw = await file.json();
					if (raw && typeof raw === "object") {
						current = raw as PodTuiConfig;
					}
				}
			} catch {
				/* unreadable existing config — treat as empty */
			}
			const next = { ...current, ...snapshot };
			await Bun.write(configPath, JSON.stringify(next, null, 2));
		} catch {
			// Fire-and-forget persistence — silently ignore write errors.
		}
	});
}

/** Resolve once every queued config write has flushed. Tests await this to
 *  observe the serialized result of pending saveFeedsToFile/updateConfig
 *  calls before asserting on config.json. */
export function whenConfigIdle(): Promise<void> {
	return writeChain;
}

/** Guards so migration runs exactly once per process. */
let migrationDone = false;
let migrationPromise: Promise<void> | null = null;

/** Run legacy migration + backup cleanup once, before the first config read. */
async function migrateOnce(): Promise<void> {
	if (migrationDone) return;
	if (!migrationPromise) migrationPromise = migrateLegacyConfig();
	await migrationPromise;
	migrationDone = true;
}

/**
 * One-time migration: if config.json doesn't exist but legacy per-section
 * files do, merge them into a single config.json. Also cleans up any stale
 * backup files (`.backup` suffix) left by the old config-backup module.
 *
 * Safe to call on every startup — no-op once config.json exists (except for
 * backup cleanup, which runs unconditionally since those files are now dead).
 */
async function migrateLegacyConfig(): Promise<void> {
	try {
		await ensureConfigDir();
		const dir = getConfigDir();
		const configExists = await Bun.file(
			getConfigFilePath(CONFIG_FILE),
		).exists();

		if (!configExists) {
			const merged: PodTuiConfig = {};

			// app-state.json → settings, preferences, customTheme
			const appStateFile = Bun.file(getConfigFilePath("app-state.json"));
			if (await appStateFile.exists()) {
				try {
					const raw = await appStateFile.json();
					if (raw && typeof raw === "object") {
						merged.settings = raw.settings;
						merged.preferences = raw.preferences;
						merged.customTheme = raw.customTheme;
					}
				} catch {
					// ignore corrupt legacy file
				}
			}

			// feeds.json → feeds
			const feedsFile = Bun.file(getConfigFilePath("feeds.json"));
			if (await feedsFile.exists()) {
				try {
					const raw = await feedsFile.json();
					if (Array.isArray(raw)) merged.feeds = raw;
				} catch {
					// ignore
				}
			}

			// sources.json → sources
			const sourcesFile = Bun.file(getConfigFilePath("sources.json"));
			if (await sourcesFile.exists()) {
				try {
					const raw = await sourcesFile.json();
					if (Array.isArray(raw)) merged.sources = raw;
				} catch {
					// ignore
				}
			}

			if (Object.keys(merged).length > 0) {
				await Bun.write(
					getConfigFilePath(CONFIG_FILE),
					JSON.stringify(merged, null, 2),
				);
				// Remove migrated legacy files
				for (const name of LEGACY_FILES) {
					await Bun.file(getConfigFilePath(name))
						.exists()
						.then(async (exists) => {
							if (exists)
								await import("fs/promises").then((fs) =>
									fs.unlink(getConfigFilePath(name)).catch(() => {}),
								);
						});
				}
			}
		}

		// Clean up stale backup files (no longer created, remove old ones)
		await cleanBackups(dir);
	} catch {
		// Migration is best-effort — never block startup.
	}
}

/** Remove all `.backup` files from the config directory. */
async function cleanBackups(dir: string): Promise<void> {
	try {
		const { readdir, unlink } = await import("fs/promises");
		const entries = await readdir(dir);
		const backups = entries.filter((e) => e.endsWith(".backup"));
		for (const name of backups) {
			await unlink(`${dir}/${name}`).catch(() => {});
		}
	} catch {
		// ignore
	}
}
