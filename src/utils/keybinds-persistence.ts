/**
 * Keybinds persistence via JSONC file in XDG_CONFIG_HOME
 *
 * Handles copying keybinds.jsonc from package to user config directory
 * and loading/saving keybind configurations.
 */

import { copyFile } from "fs/promises";
import path from "path";
import { parseJSONC } from "./jsonc";
import { getConfigFilePath, ensureConfigDir } from "./config-dir";
import type { KeybindsResolved } from "../context/KeybindContext";

const KEYBINDS_SOURCE = path.join(
	process.cwd(),
	"src",
	"config",
	"keybinds.jsonc",
);
const KEYBINDS_FILE = "keybinds.jsonc";

/** Default keybinds (yazi-style) — mirrors src/config/keybinds.jsonc so the
 *  app works before a user keybinds file is copied into place. */
const DEFAULT_KEYBINDS: KeybindsResolved = {
	// movement
	"move-down": ["j", "down"],
	"move-up": ["k", "up"],
	"page-down": ["ctrl-d"],
	"page-up": ["ctrl-u"],
	"full-down": ["ctrl-f"],
	"full-up": ["ctrl-b"],
	"jump-down": ["J"],
	"jump-up": ["K"],
	"goto-top": [["g", "g"]],
	"goto-bottom": ["G"],
	// pane swipe
	"swipe-prev": ["h", "left"],
	"swipe-next": ["l", "right"],
	// open / select
	open: ["return", "enter"],
	"open-interactive": ["shift-return"],
	"toggle-select": ["space"],
	"visual-mode": ["v"],
	"toggle-all": ["ctrl-a"],
	"invert-all": ["ctrl-r"],
	escape: ["escape", "ctrl-["],
	// tabs
	"tab-prev": ["["],
	"tab-next": ["]"],
	"tab-goto-1": ["1"],
	"tab-goto-2": ["2"],
	"tab-goto-3": ["3"],
	"tab-goto-4": ["4"],
	"tab-goto-5": ["5"],
	"tab-goto-6": ["6"],
	// command palette / help / quit
	// q opens the palette (type q + Enter to quit there); Q is the quick quit.
	command: [":", "q"],
	quit: ["Q", "ctrl-c"],
	help: ["~", "f1"],
	// list ops
	search: ["s"],
	filter: ["f"],
	sort: [","],
	"toggle-hidden": ["."],
	refresh: ["r"],
	unsubscribe: ["x"],
	// downloads
	download: ["d"],
	"delete-download": ["D"],
	"whitelist-toggle": ["w"],
	// audio transport (preserved; shifted single keys, no collisions)
	"audio-toggle": ["P"],
	"audio-next": ["N"],
	"audio-prev": ["B"],
	"audio-seek-forward": ["shift-."], // > = shift+.
	"audio-seek-backward": ["shift-,"], // < = shift+,
};

/** Copy keybinds.jsonc to user config directory on first run */
export async function copyKeybindsIfNeeded(): Promise<void> {
	try {
		const targetPath = getConfigFilePath(KEYBINDS_FILE);

		const targetFile = Bun.file(targetPath);
		if (await targetFile.exists()) return;

		await ensureConfigDir();
		await copyFile(KEYBINDS_SOURCE, targetPath);
	} catch {
		// Silently ignore errors
	}
}

/** Load keybinds from JSONC file */
export async function loadKeybindsFromFile(): Promise<KeybindsResolved> {
	try {
		const filePath = getConfigFilePath(KEYBINDS_FILE);
		const file = Bun.file(filePath);

		if (!(await file.exists())) return DEFAULT_KEYBINDS;

		const raw = await file.text();
		const parsed = parseJSONC(raw);

		if (!parsed || typeof parsed !== "object") return DEFAULT_KEYBINDS;

		// Merge so partial user configs inherit defaults for missing keys.
		return { ...DEFAULT_KEYBINDS, ...parsed } as KeybindsResolved;
	} catch {
		return DEFAULT_KEYBINDS;
	}
}

/** Save keybinds to JSONC file */
export async function saveKeybindsToFile(
	keybinds: KeybindsResolved,
): Promise<void> {
	try {
		await ensureConfigDir();
		const filePath = getConfigFilePath(KEYBINDS_FILE);
		await Bun.write(filePath, JSON.stringify(keybinds, null, 2));
	} catch {
		// Silently ignore write errors
	}
}
