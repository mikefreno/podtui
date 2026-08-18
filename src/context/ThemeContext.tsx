import { execFileSync } from "node:child_process";
import { createEffect, createMemo, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useRenderer } from "@opentui/solid";
import type { ThemeName } from "../types/settings";
import type { ThemeJson } from "../types/theme-schema";
import { useAppStore } from "../stores/app";
import { THEME_JSON } from "../constants/themes";
import {
  generateSyntax,
  generateSubtleSyntax,
} from "../utils/syntax-highlighter";
import { resolveTerminalTheme } from "../utils/theme";
import { getCustomThemes } from "../utils/custom-themes";
import { detectModeFromBackground } from "../utils/system-theme";
import { createSimpleContext } from "./helper";
import {
  setupThemeSignalHandler,
  emitThemeChanged,
  emitThemeModeChanged,
} from "../utils/theme-observer";
import {
  createTerminalPalette,
  type RGBA,
  type TerminalColors,
} from "@opentui/core";

export type ThemeResolved = {
  primary: RGBA;
  secondary: RGBA;
  accent: RGBA;
  error: RGBA;
  warning: RGBA;
  success: RGBA;
  info: RGBA;
  text: RGBA;
  textMuted: RGBA;
  textPrimary: RGBA;
  textSecondary: RGBA;
  textTertiary: RGBA;
  textSelectedPrimary: RGBA;
  textSelectedSecondary: RGBA;
  textSelectedTertiary: RGBA;

  background: RGBA;
  backgroundPanel: RGBA;
  backgroundElement: RGBA;
  backgroundMenu: RGBA;
  border: RGBA;
  borderActive: RGBA;
  borderSubtle: RGBA;
  diffAdded: RGBA;
  diffRemoved: RGBA;
  diffContext: RGBA;
  diffHunkHeader: RGBA;
  diffHighlightAdded: RGBA;
  diffHighlightRemoved: RGBA;
  diffAddedBg: RGBA;
  diffRemovedBg: RGBA;
  diffContextBg: RGBA;
  diffLineNumber: RGBA;
  diffAddedLineNumberBg: RGBA;
  diffRemovedLineNumberBg: RGBA;
  markdownText: RGBA;
  markdownHeading: RGBA;
  markdownLink: RGBA;
  markdownLinkText: RGBA;
  markdownCode: RGBA;
  markdownBlockQuote: RGBA;
  markdownEmph: RGBA;
  markdownStrong: RGBA;
  markdownHorizontalRule: RGBA;
  markdownListItem: RGBA;
  markdownListEnumeration: RGBA;
  markdownImage: RGBA;
  markdownImageText: RGBA;
  markdownCodeBlock: RGBA;
  syntaxComment: RGBA;
  syntaxKeyword: RGBA;
  syntaxFunction: RGBA;
  syntaxVariable: RGBA;
  syntaxString: RGBA;
  syntaxNumber: RGBA;
  syntaxType: RGBA;
  syntaxOperator: RGBA;
  syntaxPunctuation: RGBA;
  muted?: RGBA;
  surface?: RGBA;
  selectedListItemText?: RGBA;
  /** Theme declares a transparent (terminal-bg-visible) background. */
  transparent?: boolean;
  layerBackgrounds?: {
    layer0: RGBA;
    layer1: RGBA;
    layer2: RGBA;
    layer3: RGBA;
  };
  _hasSelectedListItemText?: boolean;
  thinkingOpacity?: number;
};

/**
 * A TerminalColors with no values — used to keep the "system" theme rendering
 * with default ANSI colors + the detected dark/light mode when the terminal
 * cannot answer OSC queries (e.g. inside tmux without OSC forwarding).
 */
const EMPTY_TERMINAL_COLORS: TerminalColors = {
  palette: Array.from({ length: 16 }, () => null),
  defaultForeground: null,
  defaultBackground: null,
  cursorColor: null,
  mouseForeground: null,
  mouseBackground: null,
  tekForeground: null,
  tekBackground: null,
  highlightBackground: null,
  highlightForeground: null,
};

/** Cached macOS appearance (dark/light), independent of the terminal. */
let cachedOsMode: "dark" | "light" | null = null;

/**
 * How often to re-query the terminal for theme changes (OSC 10/11/12).
 * Terminals only answer these queries — they never push a color change —
 * so detection is a slow poll. 60 s keeps CPU cost unmeasurable while
 * still tracking theme flips within a reasonable delay.
 */
const SYSTEM_THEME_POLL_MS = 60_000;

/**
 * Detect the terminal's dark/light mode.
 *
 * Priority:
 *   1. The terminal's real background color (OSC 11 response) — terminal-specific.
 *   2. The macOS appearance via `defaults read -g AppleInterfaceStyle` — works
 *      even inside tmux, where OSC queries are usually not forwarded.
 *      An unset value means light mode (macOS defaults to light).
 *   3. null → keep whatever mode is currently active.
 */
function detectSystemMode(
  colors: TerminalColors | null,
): "dark" | "light" | null {
  const fromBg = detectModeFromBackground(colors?.defaultBackground);
  if (fromBg) return fromBg;

  if (process.platform === "darwin" && cachedOsMode === null) {
    let style: string | null = null;
    try {
      style = execFileSync("defaults", ["read", "-g", "AppleInterfaceStyle"], {
        encoding: "utf8",
        timeout: 2000,
      })
        .trim()
        .toLowerCase();
    } catch {
      // Unset → light appearance (macOS default).
    }
    cachedOsMode = style?.includes("dark") ? "dark" : "light";
  }

  return cachedOsMode;
}

/**
 * Theme context using the createSimpleContext pattern.
 *
 * This ensures children are NOT rendered until the theme is ready,
 * preventing "useTheme must be used within a ThemeProvider" errors.
 *
 */
export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: { mode: "dark" | "light" }) => {
    const appStore = useAppStore();
    const renderer = useRenderer();
    const [store, setStore] = createStore({
      themes: THEME_JSON as Record<string, ThemeJson>,
      mode: props.mode,
      active: appStore.state().settings.theme as string,
      system: undefined as undefined | TerminalColors,
      ready: false,
    });

    function init() {
      resolveSystemTheme();
      getCustomThemes()
        .then((custom) => {
          setStore(
            produce((draft) => {
              Object.assign(draft.themes, custom);
            }),
          );
        })
        .catch(() => {
          setStore("active", "catppuccin");
        })
        .finally(() => {
          if (store.active !== "system") {
            setStore("ready", true);
          }
        });
    }

    async function waitForCapabilities(timeoutMs = 300) {
      if (renderer.capabilities) return;
      await new Promise<void>((resolve) => {
        let done = false;
        const onCaps = () => {
          if (done) return;
          done = true;
          renderer.off("capabilities", onCaps);
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          renderer.off("capabilities", onCaps);
          resolve();
        }, timeoutMs);
        renderer.on("capabilities", onCaps);
      });
    }

    /**
     * Query the terminal's colors via OSC (palette + default fg/bg), with a
     * legacy-tmux fallback for servers < 3.6 that don't forward OSC replies.
     * Returns null when the terminal cannot answer.
     */
    async function queryTerminalColors(): Promise<TerminalColors | null> {
      if (process.env.TMUX) {
        await waitForCapabilities();
      }

      let colors: TerminalColors | null = null;

      try {
        colors = await renderer.getPalette({ size: 16 });
      } catch {
        colors = null;
      }

      if (!colors?.palette?.[0] && process.env.TMUX) {
        const writeOut = (
          renderer as unknown as {
            writeOut?: (data: string | Buffer) => boolean;
          }
        ).writeOut;
        const writeFn =
          typeof writeOut === "function"
            ? writeOut.bind(renderer)
            : process.stdout.write.bind(process.stdout);
        const detector = createTerminalPalette(
          process.stdin,
          process.stdout,
          writeFn,
          true,
        );
        try {
          const tmuxColors = await detector.detect({ size: 16, timeout: 1200 });
          if (tmuxColors?.palette?.[0]) {
            colors = tmuxColors;
          }
        } finally {
          detector.cleanup();
        }
      }

      return colors;
    }

    async function resolveSystemTheme() {
      const colors = await queryTerminalColors();

      // ── dark/light mode detection ─────────────────────────────────────────
      // The provider starts with a hardcoded mode (e.g. "dark"); detect the
      // real one from the terminal's background color (OSC 11) or, when that
      // is unavailable (tmux without OSC forwarding), the OS appearance.
      const detectedMode = detectSystemMode(colors);
      if (detectedMode && detectedMode !== store.mode) {
        setStore("mode", detectedMode);
        emitThemeModeChanged(detectedMode);
      }

      const hasPalette = Boolean(
        colors?.palette?.some((value) => Boolean(value)),
      );
      const hasDefaultColors = Boolean(
        colors?.defaultBackground || colors?.defaultForeground,
      );

      if (!hasPalette && !hasDefaultColors) {
        // No system colors available — the terminal can't answer OSC queries
        // (e.g. inside tmux, or unsupported terminals). Keep the "system"
        // theme anyway: the detected dark/light mode plus default ANSI colors
        // still produce a usable, mode-correct palette.
        if (store.active === "system") {
          setStore(
            produce((draft) => {
              draft.system = colors ?? EMPTY_TERMINAL_COLORS;
              draft.ready = true;
            }),
          );
        }
        return;
      }

      if (colors) {
        setStore(
          produce((draft) => {
            draft.system = colors;
            if (store.active === "system") {
              draft.ready = true;
            }
          }),
        );
      }
    }

    /**
     * Poll for terminal theme changes: re-query OSC colors, update the
     * system palette when it differs, and re-detect dark/light mode.
     * Runs on a slow timer (see SYSTEM_THEME_POLL_MS); most polls change
     * nothing and only pay the idle query round-trip.
     */
    async function pollSystemTheme() {
      if (!store.ready) return;
      const colors = await queryTerminalColors();
      if (!colors) return;

      const current = store.system;
      const changed =
        !current ||
        current.defaultBackground !== colors.defaultBackground ||
        current.defaultForeground !== colors.defaultForeground ||
        current.palette.join(",") !== colors.palette.join(",");

      if (changed) {
        setStore(
          produce((draft) => {
            draft.system = colors;
          }),
        );
      }

      // Refresh the OS-appearance fallback only when the terminal cannot
      // report a background (e.g. tmux without OSC forwarding), so the
      // common path never spawns a subprocess.
      if (process.platform === "darwin" && !colors.defaultBackground) {
        cachedOsMode = null;
      }
      const detectedMode = detectSystemMode(colors);
      if (detectedMode && detectedMode !== store.mode) {
        setStore("mode", detectedMode);
        emitThemeModeChanged(detectedMode);
      }
    }

    onMount(init);

    // Poll the terminal for theme changes (see pollSystemTheme). Registered
    // once per provider init — SIGUSR2 re-runs the inner `init`, not this
    // closure, so the timer cannot stack.
    const pollTimer = setInterval(() => {
      void pollSystemTheme();
    }, SYSTEM_THEME_POLL_MS);
    onCleanup(() => clearInterval(pollTimer));

    // Setup SIGUSR2 signal handler for dynamic theme reload
    // This allows external tools to trigger a theme refresh by sending:
    // `kill -USR2 <pid>`
    const cleanupSignalHandler = setupThemeSignalHandler(() => {
      renderer.clearPaletteCache();
      init();
    });
    onCleanup(cleanupSignalHandler);

    // Sync active theme with app store settings
    createEffect(() => {
      const theme = appStore.state().settings.theme;
      if (theme) setStore("active", theme);
    });

    // Emit theme change events for observers
    createEffect(() => {
      const theme = store.active;
      const mode = store.mode;
      if (store.ready) {
        emitThemeChanged(theme, mode);
      }
    });

    const values = createMemo(() => {
      return resolveTerminalTheme(
        store.themes,
        store.active,
        store.mode,
        store.system,
      );
    });

    const syntax = createMemo(() =>
      generateSyntax(values() as unknown as Record<string, RGBA>),
    );
    const subtleSyntax = createMemo(() =>
      generateSubtleSyntax(
        values() as unknown as Record<string, RGBA> & {
          thinkingOpacity?: number;
        },
      ),
    );

    return {
      theme: new Proxy(values(), {
        get(_target, prop) {
          // @ts-expect-error - dynamic property access
          return values()[prop];
        },
      }) as ThemeResolved,
      get selected() {
        return store.active;
      },
      all() {
        return store.themes;
      },
      syntax,
      subtleSyntax,
      mode() {
        return store.mode;
      },
      /** Whether the app background should be transparent (no solid fill):
       *  either the global preference is on, or the selected theme declares
       *  transparency (e.g. the system theme). */
      transparentBackground() {
        return (
          appStore.state().settings.transparentBackground ||
          values().transparent === true
        );
      },
      setMode(mode: "dark" | "light") {
        setStore("mode", mode);
        emitThemeModeChanged(mode);
      },
      set(theme: string) {
        appStore.setTheme(theme as ThemeName);
      },
      get ready() {
        return store.ready;
      },
    };
  },
});
