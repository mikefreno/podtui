/**
 * system-theme.test.ts — dark/light mode detection for the "system" theme.
 *
 * Covers the pure luminance helper `detectModeFromBackground` and the
 * `generateSystemTheme` defaults when the terminal cannot answer OSC queries
 * (empty palette): the fallback background/foreground must follow the detected
 * mode (dark → white-on-black, light → black-on-white) instead of always
 * assuming a dark terminal.
 */
import { test, expect } from "bun:test";
import { RGBA, type TerminalColors } from "@opentui/core";
import {
  detectModeFromBackground,
  generateSystemTheme,
} from "../src/utils/system-theme";

/** A TerminalColors with no real values — simulates a terminal that can't
 *  answer OSC palette/background queries (e.g. tmux without forwarding). */
const EMPTY: TerminalColors = {
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

test("detectModeFromBackground maps dark backgrounds to dark", () => {
  expect(detectModeFromBackground("#181825")).toBe("dark");
  expect(detectModeFromBackground("#000000")).toBe("dark");
});

test("detectModeFromBackground maps light backgrounds to light", () => {
  expect(detectModeFromBackground("#ffffff")).toBe("light");
  expect(detectModeFromBackground("#f0f0f0")).toBe("light");
  expect(detectModeFromBackground("#c8c8c8")).toBe("light");
});

test("detectModeFromBackground returns null without a background", () => {
  expect(detectModeFromBackground(null)).toBeNull();
  expect(detectModeFromBackground(undefined)).toBeNull();
  expect(detectModeFromBackground("")).toBeNull();
});

test("empty palette in dark mode falls back to light-on-dark text", () => {
  const theme = generateSystemTheme(EMPTY, "dark").theme;
  // fg defaults to #ffffff; r/g/b are 0..1 floats
  expect((theme.text as RGBA).r).toBeGreaterThan(0.9);
  expect((theme.text as RGBA).g).toBeGreaterThan(0.9);
  expect((theme.text as RGBA).b).toBeGreaterThan(0.9);
});

test("system theme declares a transparent background", () => {
  const theme = generateSystemTheme(EMPTY, "dark").theme;
  // The system theme lets the terminal's own background show through.
  expect(theme.transparent).toBe(true);
  expect((theme.background as RGBA).a).toBe(0);
});

test("empty palette in light mode falls back to dark-on-light text", () => {
  const theme = generateSystemTheme(EMPTY, "light").theme;
  // fg defaults to #000000
  expect((theme.text as RGBA).r).toBeLessThan(0.1);
  expect((theme.text as RGBA).g).toBeLessThan(0.1);
  expect((theme.text as RGBA).b).toBeLessThan(0.1);
});

test("empty palette in light mode uses a light background, not black", () => {
  const theme = generateSystemTheme(EMPTY, "light").theme;
  // bg defaults to #ffffff; the diff/panel grays derive from it, so the
  // backgroundPanel must be light (high luminance), not near-black.
  expect((theme.backgroundPanel as RGBA).r).toBeGreaterThan(0.5);
});

test("a real light background yields a light theme regardless of mode arg", () => {
  const colors: TerminalColors = {
    ...EMPTY,
    defaultBackground: "#f5f5f5",
    defaultForeground: "#111111",
  };
  const theme = generateSystemTheme(colors, "dark").theme;
  // The actual terminal background wins over the mode default.
  expect(detectModeFromBackground(colors.defaultBackground)).toBe("light");
  expect((theme.backgroundPanel as RGBA).r).toBeGreaterThan(0.5);
});
