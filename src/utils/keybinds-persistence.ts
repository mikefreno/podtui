/**
 * Keybinds persistence via JSONC file in XDG_CONFIG_HOME
 *
 * Handles copying keybind.jsonc from package to user config directory
 * and loading/saving keybind configurations.
 */

import { copyFile, mkdir } from "fs/promises";
import path from "path";
import { parseJSONC } from "./jsonc";
import { getConfigFilePath, ensureConfigDir } from "./config-dir";
import type { KeybindsResolved } from "../context/KeybindContext";

const KEYBINDS_SOURCE = path.join(
  process.cwd(),
  "src",
  "config",
  "keybind.jsonc",
);
const KEYBINDS_FILE = "keybinds.jsonc";

/** Default keybinds from package */
const DEFAULT_KEYBINDS: KeybindsResolved = {
  up: ["up", "k"],
  down: ["down", "j"],
  left: ["left", "h"],
  right: ["right", "l"],
  cycle: ["tab"],
  dive: ["return"],
  select: ["return"],
  out: ["esc"],
  inverseModifier: "shift",
  leader: ":",
  quit: ["<leader>q"],
  "audio-toggle": ["<leader>p"],
  "audio-pause": [],
  "audio-play": [],
  "audio-next": ["<leader>n"],
  "audio-prev": ["<leader>l"],
  "audio-seek-forward": ["<leader>sf"],
  "audio-seek-backward": ["<leader>sb"],
};

/** Copy keybind.jsonc to user config directory on first run */
export async function copyKeybindsIfNeeded(): Promise<void> {
  try {
    const targetPath = getConfigFilePath(KEYBINDS_FILE);

    // Check if file already exists
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
