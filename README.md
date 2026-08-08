# PodTui

A keyboard-first, yazi-style terminal podcast client written in TypeScript and
built on [OpenTUI](https://github.com/opentui/opentui). Subscribe to RSS feeds,
browse episodes in a three-pane file-manager layout, and play audio through an
external player with full transport control — all from your terminal.

## Features

- **Vim/yazi-style navigation** — `j/k` to move, `h/l` to swipe between panes,
  `Enter` to open, `1–6` / `[` `]` to switch tabs. The tab list is the app root:
  at launch it fills the current pane, and drilling into a tab's contents slides
  it into the parent pane.
- **Three-pane view** — parent / current / preview (Up | Current | Preview),
  mirroring yazi's pane model.
- **Podcast feeds** — add feeds, browse episodes, and manage your library
  (My Shows, Discover, Feed tabs).
- **Search** across your subscribed shows.
- **Audio playback** through an external player with full transport control:
  play/pause, next/previous, seek, speed, and per-episode resume progress.
- **Themeable** and **remappable keybindings**.
- Ships as a **standalone compiled binary** — no runtime or install step beyond
  a system audio player.

## Requirements

- A terminal with UTF-8 and modern color support (kitty, iTerm2, WezTerm,
  tmux, GNOME Terminal, etc.).
- An **audio player** on `PATH`. PodTui auto-detects in priority order:

  | Player   | Platforms      | Seek | Speed | Position tracking |
  |----------|----------------|:----:|:-----:|:------------------|
  | `mpv`     | any            | ✔    | ✔     | ✔ (recommended)   |
  | `ffplay`  | any            | ✔    | ✘     | ✘                 |
  | `afplay`  | macOS built-in | ✔    | ✔     | ✘                 |
  | `open`/`xdg-open` | any    | ✘    | ✘     | ✘                 |

  Install `mpv` for the best experience (`brew install mpv`,
  `sudo apt install mpv`, `pacman -S mpv`). You can force a specific backend
  with `PODTUI_AUDIO_BACKEND=mpv|ffplay|afplay|system|none`.

## Installation

PodTui distributes as a **self-contained binary** for macOS (arm64/x64) and
Linux (arm64/x64). Pick whichever fits your platform.

### 1. Homebrew (macOS)

```sh
brew install mikefreno/podtui/podtui   # requires mpv: brew install mpv
```

> The formula installs the standalone binary plus its two native libraries
> side by side (see [Packaging model](#packaging-model)). It does **not**
> depend on Bun.

### 2. Standalone tarball (all platforms)

Grab `podtui-<platform>-<arch>.tar.gz` from the latest
[GitHub Release](https://github.com/mikefreno/podtui/releases), unpack it, and
put `podtui` on your `PATH`:

```bash
curl -sS -o /tmp/podtui.tar.gz \
  https://github.com/mikefreno/podtui/releases/latest/download/podtui-linux-x64.tar.gz
sudo mkdir -p /opt/podtui
sudo tar -xzf /tmp/podtui.tar.gz -C /opt/podtui --strip-components=1
sudo ln -sf /opt/podtui/podtui /usr/local/bin/podtui
```

> The tarball contains `podtui` plus `libopentui.<ext>` and
> `libcavacore.<ext>` **beside it** — keep them together (don't move just the
> binary alone), or the native FFI libraries won't load.
>
> One caveat: the embedded runtime reads a `bunfig.toml` from the directory
> you launch from. If that file has a `preload` entry (as Bun project
> directories often do), startup fails with `preload not found`. Launching
> from a normal directory (home, `~/bin`, …) works fine.

### 3. Arch Linux (AUR)

```bash
# Status: PKGBUILD ready, not yet on the AUR (see note below)
yay -S podtui-bin   # once published
```

Requires an AUR helper ([paru](https://github.com/morgan/paru)). The AUR
package (PKGBUILD lives in `packaging/aur/`) installs the released binary and
its two FFI sibling libraries into `/usr/lib/podtui/` with a `/usr/bin/podtui`
symlink, and pulls in `mpv` (the sole audio backend) as a dependency.

> **Not yet on the AUR.** The `podtui-bin` PKGBUILD and `.SRCINFO` are ready
> in `packaging/aur/` and can be built locally today:
>
> ```bash
> cd packaging/aur && makepkg -si
> ```
>
> Publishing is on hold until [AUR account registrations](https://aur.archlinux.org)
> reopen (suspended while the AUR team works on suspicious-package
> moderation). Once a key can be registered, push `PKGBUILD` + `.SRCINFO`
> with `git push ssh://aur@aur.archlinux.org/podtui-bin` and update this note.

### 4. From source

Requires [Bun](https://bun.sh) ≥ 1.2.

```bash
git clone https://github.com/mikefreno/podtui.git
cd podtui
bun install
bun run build:native   # build the cavacore FFI lib from C source
bun run dev            # run with hot reload, or: bun start
```

## Linux distribution notes

PodTUI deliberately does **not** ship `.deb`, `.rpm`, Flatpak, or Snap
packages. For a terminal application that's overwhelmingly installed through
repositories or archives, those formats add desktop-sandboxing overhead and a
packaging tax with little benefit. Instead:

- **GitHub Release tarballs** are the universal path — one upload, works on
  any distro with `curl` + `tar`.
- **AUR (`podtui-bin`)** covers Arch. Anyone on Arch/Manjaro gets the same
  binary through their native package manager.
- **Nix / cross-distro** users can build from source (or a Nix flake can be
  added later).

This keeps maintenance to a single build per OS/arch and still reaches the
vast majority of desktop Linux users through their preferred path.

## Usage

Launch `podtui` (or `bun src/index.tsx` from the source tree). Press `~`
for the in-app help.

### Command-line flags

| Flag | Description |
|------|-------------|
| `-v`, `--version` | Print the version and exit |
| `-q`, `--query <term>` | Query feeds for a show title and print matching shows, without launching the TUI |
| `-p`, `--play <term>` | Play the matching show, without launching the TUI |

### Keybindings

All keys are remappable — edit `~/.config/podtui/keybinds.jsonc`.

| Keys | Action |
|------|--------|
| `j` / `k` | Move cursor down / up |
| `J` / `K` | Jump 5 lines |
| `ctrl-d` / `ctrl-u` | Page down / up |
| `gg` / `G` | Go to top / bottom |
| `h` / `l` | Swipe to parent pane / preview pane |
| `Enter` | Open the item under the cursor (a tab, episode, show…) |
| `Space` | Select / toggle selection |
| `v` | Visual mode (multi-select) |
| `1`–`6` | Jump to tab 1–6 (Feed, My Shows, Discover, Search, Player, Settings) |
| `[` / `]` | Previous / next tab |
| `P` (shift) | Play / pause |
| `N` / `B` | Next / previous episode |
| `shift-.` / `shift-,` | Seek forward / backward |
| `s` | Search (in a list) |
| `f` | Filter |
| `r` | Refresh |
| `:` | Command bar |
| `~`, `f1` | Help |
| `q`, `ctrl-c` | Quit |
| `Esc` | Escape / cancel |

## Configuration

Configuration lives under the XDG config directory — `~/.config/podtui` by
default (`$XDG_CONFIG_HOME/podtui` if set).

| File | Purpose |
|------|---------|
| `feeds.json` | Your subscribed feeds (RSS/podcast sources) |
| `sources.json` | Custom feed sources |
| `downloads.json` | Downloaded episode metadata |
| `keybinds.jsonc` | Keybinding remaps (see above) |
| `themes/` | Optional custom theme files |

Env overrides: `PODTUI_AUDIO_BACKEND`, `XDG_CONFIG_HOME`. Startup also reads
the same OpenTUI environment variables.

## Development

```bash
bun install        # install dependencies
bun run dev        # run with hot reload
bun test           # run the test suite
bun run build      # bundle JS + copy native libs into dist/
make native        # rebuild cavacore from C source
make lint          # type-check (tsc)
```

### Releasing

Tag a release (e.g. `v0.1.0`); CI builds and uploads the per-platform tarballs
to your GitHub Release automatically:

```bash
make dist        # build the standalone binary + tarball for THIS platform
make dist-mac    # (run on macOS)    → podtui-darwin-<arch>.tar.gz
make dist-linux  # (run on Linux)    → podtui-linux-<arch>.tar.gz
```

`make dist` emits a config-independent binary: Bun does not bake bunfig
settings into `--compile` output, and the solid JSX transform is registered in
`build.ts` itself. The binary then embeds the `preload`-free runtime, so launch
it from any normal directory.

## Packaging model

A release tarball is three files sitting side by side:

```
podtui                  # standalone compiled binary (embeds the Bun runtime)
libopentui.<dylib|so>   # OpenTUI native renderer FFI library
libcavacore.<dylib|so>  # cavacore spectrum FFI library (built from C)
```

PodTui loads its native libraries relative to the binary, so **keep them in
the same directory**. The compiled binary embeds the Bun runtime, so it runs
with no Bun installed. Each release builds one tarball per OS/arch in CI; there
is no cross-compilation.

## License

MIT. See [LICENSE](LICENSE).

## Related

- [OpenTUI](https://github.com/opentui/opentui) — the TUI framework driving the interface
