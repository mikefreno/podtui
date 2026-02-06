import { RGBA, type TerminalColors } from "@opentui/core";
import { ansiToRgba } from "./ansi-to-rgba";
import {
  generateGrayScale,
  generateMutedTextColor,
  tint,
} from "./color-generation";
import type { ThemeJson } from "../types/theme-schema";

let cached: TerminalColors | null = null;

export function clearPaletteCache() {
  cached = null;
}

export function detectSystemTheme(colors: TerminalColors) {
  const bg = RGBA.fromHex(
    colors.defaultBackground ?? colors.palette[0] ?? "#000000",
  );
  const luminance = 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b;
  const mode = luminance > 0.5 ? "light" : "dark";
  return { mode, background: bg };
}

export function generateSystemTheme(
  colors: TerminalColors,
  mode: "dark" | "light",
): ThemeJson {
  cached = colors;
  const bg = RGBA.fromHex(
    colors.defaultBackground ?? colors.palette[0] ?? "#000000",
  );
  const fg = RGBA.fromHex(
    colors.defaultForeground ?? colors.palette[7] ?? "#ffffff",
  );
  const transparent = RGBA.fromInts(0, 0, 0, 0);
  const isDark = mode === "dark";

  const col = (i: number) => {
    const value = colors.palette[i];
    if (value) return RGBA.fromHex(value);
    return ansiToRgba(i);
  };

  const grays = generateGrayScale(bg, isDark);
  const textMuted = generateMutedTextColor(bg, isDark);

  const ansi = {
    black: col(0),
    red: col(1),
    green: col(2),
    yellow: col(3),
    blue: col(4),
    magenta: col(5),
    cyan: col(6),
    white: col(7),
    redBright: col(9),
    greenBright: col(10),
  };

  const diffAlpha = isDark ? 0.22 : 0.14;
  const diffAddedBg = tint(bg, ansi.green, diffAlpha);
  const diffRemovedBg = tint(bg, ansi.red, diffAlpha);
  const diffAddedLineNumberBg = tint(grays[3], ansi.green, diffAlpha);
  const diffRemovedLineNumberBg = tint(grays[3], ansi.red, diffAlpha);

  return {
    theme: {
      primary: ansi.cyan,
      secondary: ansi.magenta,
      accent: ansi.cyan,
      error: ansi.red,
      warning: ansi.yellow,
      success: ansi.green,
      info: ansi.cyan,
      text: fg,
      textMuted,
      selectedListItemText: bg,
      background: transparent,
      backgroundPanel: grays[2],
      backgroundElement: grays[3],
      backgroundMenu: grays[3],
      borderSubtle: grays[6],
      border: fg,
      borderActive: grays[8],
      diffAdded: ansi.green,
      diffRemoved: ansi.red,
      diffContext: grays[7],
      diffHunkHeader: grays[7],
      diffHighlightAdded: ansi.greenBright,
      diffHighlightRemoved: ansi.redBright,
      diffAddedBg,
      diffRemovedBg,
      diffContextBg: grays[1],
      diffLineNumber: grays[6],
      diffAddedLineNumberBg,
      diffRemovedLineNumberBg,
      markdownText: fg,
      markdownHeading: fg,
      markdownLink: ansi.blue,
      markdownLinkText: ansi.cyan,
      markdownCode: ansi.green,
      markdownBlockQuote: ansi.yellow,
      markdownEmph: ansi.yellow,
      markdownStrong: fg,
      markdownHorizontalRule: grays[7],
      markdownListItem: ansi.blue,
      markdownListEnumeration: ansi.cyan,
      markdownImage: ansi.blue,
      markdownImageText: ansi.cyan,
      markdownCodeBlock: fg,
      syntaxComment: textMuted,
      syntaxKeyword: ansi.magenta,
      syntaxFunction: ansi.blue,
      syntaxVariable: fg,
      syntaxString: ansi.green,
      syntaxNumber: ansi.yellow,
      syntaxType: ansi.cyan,
      syntaxOperator: ansi.cyan,
      syntaxPunctuation: fg,
    },
  };
}
