/**
 * bar-mapping tests — the pure waveform bar-scaling helpers.
 *
 * Two contracts are pinned:
 *
 *   • barChars: the 2-row / 16-level bar rendering. The partial block
 *     always sits in the TOP row (glyph bottom edge = row bottom) so a
 *     full block below renders a visually continuous 2-cell column —
 *     this is the "double the default height" requirement.
 *
 *   • createBarScaler: the peak-follower normalization that replaces
 *     cava's autosens. The regression this guards: bars suddenly maxing
 *     out when audio starts. A loud first frame must normalize to a
 *     single full bar (the peak), not pin every bar at full height, and
 *     quiet content after a loud passage must still recover (slow
 *     release) instead of staying dead.
 */

import { describe, test, expect } from "bun:test";
import { barChars, createBarScaler, BAR_LEVELS } from "../src/utils/bar-mapping";

describe("barChars", () => {
	test("level 0 is two spaces (silence)", () => {
		expect(barChars(0)).toEqual({ top: " ", bottom: " " });
	});

	test("levels 1..8 fill the bottom row only, partial block on top row stays empty", () => {
		expect(barChars(1)).toEqual({ top: " ", bottom: "\u2581" });
		expect(barChars(4)).toEqual({ top: " ", bottom: "\u2584" });
		expect(barChars(8)).toEqual({ top: " ", bottom: "\u2588" });
	});

	test("levels 9..16 fill the bottom row and put the partial in the top row", () => {
		expect(barChars(9)).toEqual({ top: "\u2581", bottom: "\u2588" });
		expect(barChars(12)).toEqual({ top: "\u2584", bottom: "\u2588" });
		expect(barChars(16)).toEqual({ top: "\u2588", bottom: "\u2588" });
	});

	test("BAR_LEVELS is 16 (double the single-row 8 levels)", () => {
		expect(BAR_LEVELS).toBe(16);
	});

	test("clamps out-of-range and NaN levels", () => {
		expect(barChars(20)).toEqual(barChars(16));
		expect(barChars(-3)).toEqual(barChars(0));
		expect(barChars(Number.NaN)).toEqual(barChars(0));
	});
});

describe("createBarScaler", () => {
	test("a loud first frame normalizes to one full bar, not all bars", () => {
		const scale = createBarScaler();
		const out = scale([0.9, 0.5, 0.1]);
		expect(out[0]).toBeCloseTo(1, 5); // the peak maps to full height
		expect(out[1]).toBeCloseTo(Math.pow(0.5 / 0.9, 0.7), 5);
		expect(out[2]).toBeCloseTo(Math.pow(0.1 / 0.9, 0.7), 5);
	});

	test("quiet frame after a loud passage recovers via slow release", () => {
		const scale = createBarScaler();
		scale([0.9]);
		// peak decays multiplicatively (release 0.985), so 0.05 gets
		// normalized up well past its raw value instead of rendering dead.
		const out = scale([0.05]);
		const expectedPeak = 0.9 * 0.985;
		expect(out[0]).toBeCloseTo(Math.pow(0.05 / expectedPeak, 0.7), 5);
	});

	test("silence maps to zeros and never inflates the peak", () => {
		const scale = createBarScaler();
		scale([0.8, 0.4]);
		const out = scale([0, 0, 0]);
		expect(out).toEqual([0, 0, 0]);
		// peak keeps decaying toward silence
		expect(scale([0])[0]).toBe(0);
	});

	test("negative values clamp to zero (no negative bars)", () => {
		const scale = createBarScaler();
		const out = scale([-0.5]);
		expect(out[0]).toBe(0);
	});

	test("empty input returns an empty array", () => {
		const scale = createBarScaler();
		expect(scale([])).toEqual([]);
	});

	test("returns a fresh array each call (no aliasing of cava's buffer)", () => {
		const scale = createBarScaler();
		const a = scale([0.5]);
		const b = scale([0.5]);
		expect(a).not.toBe(b);
		a[0] = 0;
		expect(b[0]).not.toBe(0);
	});
});
