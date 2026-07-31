/**
 * Yazi-style keybind reference (mirrors src/config/keybinds.jsonc).
 * Shown in help overlays; the canonical source remains keybinds.jsonc.
 * Edit that file (or ~/.config/podtui/keybinds.jsonc) to remap.
 */
export const shortcuts = [
	{ keys: "j / k", action: "Move down / up (within pane)" },
	{ keys: "h / l", action: "Swipe to prev / next pane" },
	{ keys: "J / K", action: "Jump 5 lines down / up" },
	{ keys: "ctrl-d / u", action: "Half page down / up" },
	{ keys: "g g / G", action: "Go to top / bottom of list" },
	{ keys: "1-6", action: "Go to tab 1-6" },
	{ keys: "[ / ]", action: "Previous / next tab" },
	{ keys: "Enter", action: "Open / activate focused item" },
	{ keys: "Space", action: "Toggle selection on item" },
	{ keys: "v", action: "Enter visual (range) select mode" },
	{ keys: "ctrl-a / ctrl-r", action: "Select all / invert selection" },
	{ keys: "Esc", action: "Clear selection / exit visual / cancel" },
	{ keys: ":", action: "Open command bar (:quit :refresh :play …)" },
	{ keys: "r / s / f", action: "Refresh / search / filter" },
	{ keys: ", / .", action: "Sort / toggle hidden" },
	{ keys: "P / N / B", action: "Play-pause / next / prev episode" },
	{ keys: "< / >", action: "Seek backward / forward 10s" },
	{ keys: "~ / F1", action: "Help" },
	{ keys: "q", action: "Quit" },
] as const;
