# PodTui

A keyboard-first, terminal podcast client built on [OpenTUI](https://github.com/opentui/opentui). Subscribe to RSS feeds,
browse episodes in a three-pane file-manager layout, and play audio through an
external player with full transport control — all from your terminal.

## Features

- **Vim/yazi-style navigation** — `j/k` to move, `h/l` to swipe between panes,
  `Enter` to open, `1–6` / `[` `]` to switch tabs. The tab list is the app root:
  at launch it fills the current pane, and drilling into a tab's contents slides
  it into the parent pane.
- **Three-pane view** — parent / current / preview (Up | Current | Preview).
- **Podcast feeds** — add feeds, browse episodes, and manage your library
  (My Shows, Discover, Feed tabs).
- **Search** across your subscribed shows.
- **Audio playback** through an external player with full transport control:
  play/pause, next/previous, seek, speed, and per-episode resume progress.
  When an episode finishes, the next one plays automatically, continuing
  down the list you started it from (search results, a show, or the Feed).
- **Themeable** and **remappable keybindings**.
- Ships as a **standalone compiled binary** — no runtime or install step beyond
  a system audio player.

## Quick start

1. Install PodTui ([Installation](#installation)) and make sure **mpv** is in
   your `PATH`.
2. Run `podtui` in your terminal.
3. Press `3` to open **Discover** (or `4` to open **Search**, then `s`), drill
   in with `Enter`, and press `Enter` on a show to subscribe.
4. Press `1` (**Feed**) or `2` (**My Shows**), open an episode with `Enter`,
   and use `P` to play/pause, `N`/`B` for next/previous, and `shift-.` /
   `shift-,` to seek.

Press `~` any time for in-app help. All keys are remappable — see
[Keybindings](#keybindings).

## Requirements

- A terminal with UTF-8 and modern color support (kitty, iTerm2, WezTerm,
  Ghostty, tmux etc.).
- **mpv** on `PATH` for audio playback. PodTui drives mpv over JSON IPC, so
  seek, speed, and position tracking all work. Without `mpv` on `PATH`,
  playback is a silent no-op (the `none` backend) — see
  [Troubleshooting](#troubleshooting).

## Installation

PodTui distributes as a **self-contained binary** for macOS (arm64/x64) and
Linux (arm64/x64). Pick whichever fits your platform.

### 1. Homebrew (macOS)

```sh
brew install mikefreno/tap/podtui
```

### 2. Standalone tarball (all platforms)

Grab `podtui-<platform>-<arch>.tar.gz` from the latest
[GitHub Release](https://github.com/mikefreno/podtui/releases), unpack it, and
put `podtui` on your `PATH`:

```bash
curl -sSL -o /tmp/podtui.tar.gz \
  https://github.com/mikefreno/podtui/releases/latest/download/podtui-linux-x64.tar.gz
sudo mkdir -p /opt/podtui
sudo tar -xzf /tmp/podtui.tar.gz -C /opt/podtui --strip-components=1
sudo ln -sf /opt/podtui/podtui /usr/local/bin/podtui
```

> The tarball contains `podtui` plus `libopentui.<ext>` and
> `libcavacore.<ext>` **beside it** — keep them together (don't move just the
> binary alone), or the native FFI libraries won't load.

### 3. Arch Linux (AUR)

```bash
yay -S podtui-bin   # once published
```

Requires an AUR helper ([paru](https://github.com/morgan/paru)); the package
pulls in `mpv` as a dependency.

> **Not yet on the AUR.** The `podtui-bin` package is staged and awaiting
> publication (AUR account registrations are currently suspended). Until it
> lands, use the standalone tarball above.

### 4. From source

PodTui is written in TypeScript and runs on [Bun](https://bun.sh). To build
from source (development, distro packaging, unreleased versions), see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Usage

Launch `podtui`. Press `~` for the in-app help.

### Command-line flags

| Flag | Description |
|------|-------------|
| `-v`, `--version` | Print the version and exit |
| `-q`, `--query <term>` | Query feeds for a show title and print matching shows, without launching the TUI |
| `-p`, `--play <term>` | Play the matching show, without launching the TUI |

### Keybindings

All keys are remappable — edit `keybinds.jsonc` in your config directory
(see [Configuration](#configuration)).

**Movement**

| Keys | Action |
|------|--------|
| `j` / `k` (or `down` / `up`) | Move down / up |
| `J` / `K` | Jump 5 lines down / up |
| `ctrl-d` / `ctrl-u` | Page down / up |
| `ctrl-f` / `ctrl-b` | Full page down / up |
| `gg` / `G` | Go to top / bottom |

**Panes**

| Keys | Action |
|------|--------|
| `h` / `l` (or `left` / `right`) | Focus parent pane / preview pane |
| `Enter` | Open the item under the cursor (a tab, episode, show…) |
| `shift-enter` | Open with the interactive variant |

**Selection**

| Keys | Action |
|------|--------|
| `Space` | Toggle selection |
| `v` | Visual mode (multi-select) |
| `ctrl-a` | Select / deselect all |
| `ctrl-r` | Invert selection |
| `Esc` | Cancel / escape |

**Tabs**

| Keys | Action |
|------|--------|
| `1`–`6` | Jump to tab 1–6 (Feed, My Shows, Discover, Search, Player, Settings) |
| `[` / `]` | Previous / next tab |

**Commands, help, quit**

| Keys | Action |
|------|--------|
| `:` or `q` | Open the command palette (type `q` + `Enter` there to quit) |
| `Q` or `ctrl-c` | Quit |
| `~` or `f1` | In-app help |

**Lists**

| Keys | Action |
|------|--------|
| `s` | Search |
| `f` | Filter |
| `,` | Sort |
| `.` | Toggle hidden |
| `r` | Refresh |
| `x` | Unsubscribe the focused show (My Shows) |
| `d` | Download the focused episode (Feed / My Shows detail pane) |
| `D` | Delete the focused episode's download (if one exists) |
| `w` | Toggle the focused show in/out of the auto-download whitelist (My Shows, whitelist scope) |

**Audio**

| Keys | Action |
|------|--------|
| `P` | Play / pause |
| `N` / `B` | Next / previous episode |
| `shift-.` / `shift-,` | Seek forward / backward |

## Configuration

Configuration lives under the XDG config directory — `~/.config/podtui` by
default (`$XDG_CONFIG_HOME/podtui` if set).

| File | Purpose |
|------|---------|
| `config.json` | Unified settings (theme, playback speed, download path), feeds, and custom feed sources |
| `downloads.json` | Downloaded episode metadata |
| `keybinds.jsonc` | Keybinding remaps (see above) |
| `themes/` | Optional custom theme files |

Legacy `feeds.json`, `sources.json`, and `app-state.json` are auto-migrated
into `config.json` on first run.

**Auto-download** — in Settings → Preferences: `Auto Download` (master
toggle) downloads the `Auto Download Count` most recent episodes (default 2,
any positive integer — type it in the editor) of every show in the `Auto
Download Scope` (all / none / whitelist, default all). With the whitelist
scope, a search field appears under the setting to pick shows (Space toggles
a suggestion in/out), and `w` in My Shows adds/removes the focused show.

Env overrides: `PODTUI_AUDIO_BACKEND`, `XDG_CONFIG_HOME`, `PODTUI_NERD_FONTS`.

**Fonts** — PodTui prepends Nerd Font glyphs to non-episode/show list rows (tabs, Discover categories, Settings sections, the Feed and per-show "Fetch More" rows). Icons are hidden automatically when your terminal font is not Nerd Font capable (no tofu, no layout gaps); detection is heuristic (terminal type), so force it with `PODTUI_NERD_FONTS=1` or `=0` if it guesses wrong. A Nerd Font-patched font (e.g. JetBrainsMono Nerd Font) is recommended.

## Troubleshooting

**`preload not found` at startup** — this used to happen when the binary was
launched from a Bun project directory whose `bunfig.toml` had a `preload`
entry. Releases are compiled with bunfig autoload disabled
(`autoloadBunfig: false`), so current binaries ignore the CWD's `bunfig.toml`
entirely. If you still hit it, you're on an old release — upgrade.

**No audio — playback is a silent no-op** — PodTui needs **mpv** on your
`PATH`. Homebrew and AUR installs pull it in automatically; if you used the
standalone tarball, install it yourself (`brew install mpv`, `pacman -S mpv`,
…) and relaunch.

**Homebrew prints a dylib warning** — “load commands do not fit in the header
… needs `-headerpad`” is benign: the app loads its libraries by path, the
install completes, and the app boots normally.

**The app won't start / no spectrum after moving files** — `podtui` loads its
two native libraries relative to the binary, so keep `podtui`,
`libopentui.*`, and `libcavacore.*` together in the same directory (the
tarball unpacks them side by side).

## Building from source / contributing

Development setup, the test suite, packaging, and the release process are
documented in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).

## Related

- [OpenTUI](https://github.com/opentui/opentui) — the TUI framework driving the interface
