/**
 * Nerd Font support detection + icon codepoints for PodTui.
 *
 * The app prepends Nerd Font glyphs to hard-defined list rows (tabs, Discover
 * categories, Settings sections, the Feed "Fetch More" row). When the user's
 * terminal font is NOT Nerd Font capable those glyphs must not render at all —
 * no tofu boxes, no empty columns — so every call site gates the icon on
 * `supportsNerdFonts()`.
 *
 * Detection is a heuristic (see `supportsNerdFonts`); the `PODTUI_NERD_FONTS`
 * env override wins over everything so a wrong guess is always fixable.
 * Under tmux the outer terminal decides — `TMUX` being set counts as
 * capable (the multiplexer passes glyphs through), matching the same choice
 * made for `screen`-prefixed TERM values. See README → Configuration → Fonts.
 *
 * This module is deliberately free of Solid/JSX imports so it stays
 * unit-testable in isolation.
 */

// ── Detection ────────────────────────────────────────────────────────────────
// Memoized: the terminal does not change mid-session, so detect once.
let cached: boolean | null = null;

/**
 * True when the terminal is (very likely) using a Nerd Font-patched font.
 *
 * Order:
 *   a. `PODTUI_NERD_FONTS` env override ("1"/"true" → true, "0"/"false" →
 *      false) — wins over everything.
 *   b. Allowlist: TERM_PROGRAM ∈ {iTerm.app, WezTerm, vscode, ghostty, rio,
 *      hyper, tabby, contour}, or TERM starts with {xterm-kitty, foot,
 *      alacritty, contour, screen} (tmux/screen passthrough — the outer
 *      terminal decides), or WT_SESSION set (Windows Terminal), or TMUX set.
 *      Case-insensitive.
 *   c. Everything else (Terminal.app default SF Mono, plain xterm, unknown)
 *      → false.
 */
export function supportsNerdFonts(): boolean {
	if (cached !== null) return cached;

	// a. Env override wins over everything.
	const override = process.env.PODTUI_NERD_FONTS?.trim().toLowerCase();
	if (override === "1" || override === "true") {
		cached = true;
		return cached;
	}
	if (override === "0" || override === "false") {
		cached = false;
		return cached;
	}

	// b. Allowlist.
	const termProgram = process.env.TERM_PROGRAM?.toLowerCase() ?? "";
	const term = process.env.TERM?.toLowerCase() ?? "";
	const TERM_PROGRAM_ALLOWLIST: Record<string, true> = {
		"iterm.app": true,
		wezterm: true,
		vscode: true,
		ghostty: true,
		rio: true,
		hyper: true,
		tabby: true,
		contour: true,
	};
	const TERM_PREFIX_ALLOWLIST = [
		"xterm-kitty",
		"foot",
		"alacritty",
		"contour",
		"screen",
	];
	cached =
		TERM_PROGRAM_ALLOWLIST[termProgram] === true ||
		TERM_PREFIX_ALLOWLIST.some((prefix) => term.startsWith(prefix)) ||
		!!process.env.WT_SESSION ||
		!!process.env.TMUX;

	// c. Everything else falls through to false.
	return cached;
}

// ── Icon codepoints ──────────────────────────────────────────────────────────
// Font Awesome codepoints in the Nerd Font PUA range — stable across Nerd
// Font versions. Keyed by the semantic names the list rows use.
export const NF_ICONS: Record<string, string> = {
	feed: "\uF09E",
	shows: "\uF005",
	discover: "\uF14E",
	search: "\uF002",
	player: "\uF144",
	settings: "\uF013",
	sync: "\uF021",
	sources: "\uF143",
	preferences: "\uF1DE",
	visualizer: "\uF080",
	downloads: "\uF019",
	all: "\uF0CA",
	technology: "\uF2DB",
	science: "\uF0C3",
	comedy: "\uF118",
	news: "\uF1EA",
	business: "\uF0B1",
	health: "\uF21E",
	education: "\uF19D",
	sports: "\uF1E3",
	"true-crime": "\uF00E",
	arts: "\uF1FC",
	more: "\uF141",
	add: "\uF067",
};

/** Glyph for a named icon when Nerd Fonts are supported, else "". */
export function nfIcon(name: string): string {
	return supportsNerdFonts() ? NF_ICONS[name] ?? "" : "";
}
