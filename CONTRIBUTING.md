# Contributing to PodTui

This file is written **for humans**. If you're an AI agent or LLM working in
this repo, read [AGENTS.md](AGENTS.md) instead — it has the machine-oriented
build/test/lint contract and code-style rules. Both describe the same project;
CONTRIBUTING.md focuses on *understanding* and *navigating* the codebase.

PodTui is a keyboard-first, yazi-style terminal podcast client. TypeScript +
[OpenTUI](https://github.com/opentui/opentui) on top, [Bun](https://bun.sh)
as the runtime and toolchain.

---

## Quick start

```bash
brew install bun          # or: curl -fsSL https://bun.sh/install | bash
git clone git@github.com:mikefreno/podtui.git
cd podtui

bun install               # install JS dependencies
make native               # build libcavacore.dylib from the vendored C source
bun run dev               # launch with hot reload (alias: make dev)
```

The app is a TUI — it expects a real terminal (Ghostty, kitty, iTerm2,
      WezTerm, tmux, …). It will not render in a plain captured `bash` session.

## What each command does

| Command            | Purpose                                                                  |
|--------------------|--------------------------------------------------------------------------|
| `bun install`      | Install JS dependencies                                                  |
| `make native`      | Compile `cava/cavacore.c` → `src/native/libcavacore.<dylib\|so>`          |
| `bun run dev`      | Run with hot reload                                                       |
| `bun run start`    | Run once (no watch)                                                       |
| `bun test`         | Run the test suite (see [Testing](#testing))                              |
| `bun run lint`        | Type-check                                         |
| `bun run build`    | Bundle JS into `dist/` + copy native libs (the `podtui` npm script path)  |
| `make dist`        | Compile the standalone binary + make the current platform's tarball       |
| `make dist-mac` / `make dist-linux` | Aliases for `dist` on their platform (CI runs these)          |
| `make clean`       | Remove `dist/`                                                             |

## Repository layout

```
src/
  api/          Network + XML/RSS — client.ts, rss-parser.ts
  components/   Reusable UI pieces: Shell, Navigation, YaziPaneRow, TabPanel…
  config/       App config: keybinds.jsonc, shortcuts, auth
  constants/    Static tables (sync formats, themes)
  context/      Solid contexts: KeybindContext, NavigationContext, ThemeContext
  hooks/        useAudio, useMultimediaKeys, useCachedData
  native/       FFI glue + the built libcavacore.{dylib,so}
  pages/        App screens: Feed, MyShows, Discover, Search, Player, Settings
  stores/       Zustand stores — app, feed, audio-nav, search, auth, progress…
  styles/       theme.css
  themes/       catppuccin, gruvbox, nord, tokyo schemes + schema.json
  types/        All shared interfaces (podcast, episode, feed, settings…)
  ui/           Modal-adjacent UI: command.tsx, dialog.tsx, toast.tsx
  utils/        Parser/persistence/audio helpers (audio-player, config-dir…)
scripts/
  build-cavacore.sh   C → shared lib; finds libfftw3.a on macOS & Debian
  tui-harness.tsx     Headless harness for scripted interaction (see below)
cava/                 Vendored cavacore C source (MIT, from karlstav/cava)
tests/                bun test suite + cavacore smoke test
dist/                 Build output (JS bundle + libs + tarballs)
```

## Native libraries: how the FFI layer works

PodTui loads **two** native libraries at runtime:

1. **libopentui** — the OpenTUI renderer (shipped inside the
   `@opentui/core-<platform>-<arch>` npm packages, copied to `dist/` by
   `build.ts`).
2. **libcavacore** — the audio spectrum renderer, built from C. The source is
   vendored under `cava/` (it must stay committed — every CI runner builds it).
   `libfftw3` is needed to build it:
   - macOS: `brew install fftw`
   - Debian/Ubuntu: `apt-get install libfftw3-dev`
   (CI installs it for you; locally run `make native`.)

**Critical sibling rule**: both libraries are loaded *relative to the binary*,
so `podtui`, `libopentui.*` and `libcavacore.*` must sit in the **same
directory**. Never move a single binary out of the tarball. The Homebrew
formula keeps all three in `libexec/` and exposes only a `podtui` symlink.

Cavacore smoke test: `bun tests/cavacore-smoke.ts`
(FFI-calls `cava_init` / `cava_execute` / `cava_destroy` and prints results).

## Gotchas (read before touching anything)

1. **The compiled binary must keep bunfig autoload disabled.**
   `build.ts` compiles the standalone with `autoloadBunfig: false`, so its
   embedded runtime *never* reads the launching CWD's `bunfig.toml`. Without
   that flag, a top-level `preload` in the CWD bunfig (common in Bun project
   dirs) resolves against the CWD rather than the binary and kills startup
   with `preload not found`. Don't remove the flag. Preloads for dev/test
   belong in the explicit `--preload` flags in `package.json` and the
   `[test]` section of `bunfig.toml` — not as a top-level entry.

2. **Smoke-test the binary from a dir with a poisoned bunfig.**
   The CI smoke test unpacks the tarball into a `mktemp` dir, drops a
   `bunfig.toml` containing an unresolvable top-level `preload` next to it,
   and boots the binary — proving bunfig autoload stayed disabled. `./dist/
   podtui --version` must work from any directory, including the repo root;
   do the same check when testing a release build locally.

3. **Homebrew's dylib-repair warning is benign.**
   `brew install` may print “load commands do not fit in the header … needs
   `-headerpad`” for a prebuilt dylib. The app dlopens the libs by path, so
   the warning is cosmetic; installs complete and the app boots.

## Testing

```bash
bun test                # full suite   (54 tests across 6 files today)
```

The suite covers the keyboard/nav model, keybind dispatch, and the yazi pane
logic; plus `tests/cavacore-smoke.ts` asserting the native lib exports.

For scripted end-to-end interaction there's a **headless harness**,
`scripts/tui-harness.tsx`: each invocation snapshot-rebuilds the app state
into a sandboxed `.harness/` config dir, replays the saved action log
(`.harness/actions.json`), executes one more key/action passed on the CLI, and
prints the resulting frame + a style summary — all without a real terminal.
Audio is a no-op during those snapshots. The last frame lands in
`.harness/last-frame.{json,txt}` for inspection.

## Releasing

Releases are built and published from **tags**

### Steps

1. Run `scripts/release-tag.sh` (interactive: pick major/minor/patch/custom,
   confirms the plan, bumps `VERSION` in `src/index.tsx`, commits, tags
   `vX.Y.Z`, and pushes branch + tag to every remote). If the version bump is
   already committed but the tag is missing, it offers a tag-only path.
   `--dry-run` prints the plan without doing anything.
2. Equivalent manual commands:

   ```bash
   git tag -a v0.2.0 -m 'PodTUI v0.2.0' && git push gh v0.2.0
   ```

3. CI (`.github/workflows/release.yml`) runs four builds in parallel,
   each producing `podtui-<platform>-<arch>.tar.gz`:

   | Runner              | Platform/Arch |
   |---------------------|---------------|
   | `ubuntu-latest`     | linux-x64     |
   | `ubuntu-24.04-arm`  | linux-arm64   |
   | `macos-15-intel`    | darwin-x64    |
   | `macos-14`          | darwin-arm64  |

   Each runner: installs deps → installs fftw → `scripts/build-cavacore.sh`
   → `make dist` → smoke-boots the binary from a temp dir → uploads the
   tarball. (`macos-15-intel` matters: GitHub's `macos-latest` is arm64 now.)

4. A release is auto-created with all 4 tarballs attached. `brew` never
   sees the new version: the **tap self-updates**: the
   `mikefreno/homebrew-tap` repo has a scheduled workflow (hourly) that
   polls GitHub releases, and when a new tag appears, rewrites
   `Formula/podtui.rb` (URLs + arm64/x64 `sha256`) and pushes it — no
   secrets. See `scripts/sync-formula.sh` in that repo for the logic. Local
   test: `brew install mikefreno/tap/podtui`.
5. **AUR packaging** (`packaging/aur/PKGBUILD`): the `podtui-bin` package is
   staged, not yet published (AUR account registrations are closed; see the
   README's Installation section). On each release, keep the AUR sources in sync
   with the new tag: bump `pkgver`, recompute the two tarball `sha256sums`
   entries, keep the `LICENSE` asset source (the workflow above uploads
   `LICENSE` to every release), and regenerate `packaging/aur/.SRCINFO` with
   `bash packaging/aur/gen-srcinfo.sh`.

### Manual fallback

If you ever need to sync the tap by hand (or before the hourly job runs):

```bash
cd <clone of mikefreno/homebrew-tap>
./scripts/sync-formula.sh 0.2.0
git commit -am 'podtui 0.2.0' && git push
```

### Local release build

```bash
make dist          # builds the binary + tarball for THIS machine only
```

Bun cannot cross-compile — the other platforms come from CI.

## Distribution & packaging

A release tarball is three files sitting side by side: the `podtui` binary
plus its two FFI libraries (`libopentui.<dylib|so>`,
`libcavacore.<dylib|so>`). The sibling rule above is why they ship together.

PodTui deliberately ships **no** `.deb`, `.rpm`, Flatpak, or Snap packages:
for a terminal app that's overwhelmingly installed through repositories or
archives, those formats add desktop-sandboxing overhead and a packaging tax
with little benefit. Instead:

- **GitHub Release tarballs** are the universal path — one upload per
  OS/arch, works on any distro with `curl` + `tar`.
- **AUR (`podtui-bin`)** covers Arch/Manjaro with the same binary through the
  native package manager.
- **Nix / cross-distro** users build from source (or a Nix flake can be added
  later).

This keeps maintenance to a single build per OS/arch while still reaching the
vast majority of desktop Linux users. The AUR PKGBUILD lives in
`packaging/aur/` and can be built locally to test before publication:

```bash
cd packaging/aur && makepkg -si
```

---

## Open items / things to sort out

- **Native libs in `dist/` still need committing?** No — they're built from
  sources kept in the repo (`cava/`, `node_modules/@opentui/core-*`). Only
  `src/native/libcavacore.dylib` is a committed binary artifact; macOS arm64
  ships from it directly until a full rebuild replaces it. On other hosts the
  `make native` build is required — see `scripts/build-cavacore.sh`.
