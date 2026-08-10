/**
 * Pure bar-scaling helpers for the terminal waveform.
 *
 * barChars maps a 0..16 level to the two characters of a 2-row bar built
 * from Unicode lower block elements (U+2581..U+2588). The partial block
 * sits in the TOP row (its glyph bottom edge = row bottom), so a full
 * block below makes a visually continuous 2-cell column — the "double the
 * default height" requirement (each bar = 2 terminal rows, 16 heights).
 *
 * createBarScaler is a stateful fast-attack / slow-release peak follower
 * that replaces cava's autosens: a loud start cannot pin every bar at
 * full height (the peak follower absorbs it) and quiet content gets
 * normalized up.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface BarScalerOptions {
	/** Peak follower decay per frame (default: 0.985) */
	release?: number;
	/** Power curve applied after normalization (default: 0.7) */
	curve?: number;
	/** Silence threshold — below this the input is treated as silent (default: 1e-6) */
	epsilon?: number;
}

// ── Constants ────────────────────────────────────────────────────────

/** Number of discrete bar heights (2 rows × 8 block levels). */
export const BAR_LEVELS = 16;

/** Lower block elements, index 0 = space (silence) through full block (max). */
const LOWER = [
	" ",
	"\u2581",
	"\u2582",
	"\u2583",
	"\u2584",
	"\u2585",
	"\u2586",
	"\u2587",
	"\u2588",
];

// ── Bar mapping ──────────────────────────────────────────────────────

/**
 * Map a bar level (0..16) to the two characters that render it as a
 * 2-row column: top row + bottom row.
 *
 * level 0        → { top: " ", bottom: " " }
 * level 1..8     → { top: " ", bottom: LOWER[level] }
 * level 9..16    → { top: LOWER[level - 8], bottom: "\u2588" }
 */
export function barChars(level: number): { top: string; bottom: string } {
	const raw = Math.floor(level);
	const lvl = Number.isFinite(raw)
		? Math.max(0, Math.min(BAR_LEVELS, raw))
		: 0;

	if (lvl === 0) return { top: " ", bottom: " " };
	if (lvl <= 8) return { top: " ", bottom: LOWER[lvl] };
	return { top: LOWER[lvl - 8], bottom: "\u2588" };
}

// ── Peak-follower scaler ─────────────────────────────────────────────

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Create a stateful bar scaler. Each call normalizes its input against a
 * peak follower (instant attack, multiplicative release), then applies a
 * power curve so low-energy content remains visible. Returns a new
 * number[] per call.
 */
export function createBarScaler(
	opts?: BarScalerOptions,
): (values: ArrayLike<number>) => number[] {
	const release = opts?.release ?? 0.985;
	const curve = opts?.curve ?? 0.7;
	const epsilon = opts?.epsilon ?? 1e-6;
	let peak = 0;

	return (values: ArrayLike<number>): number[] => {
		let frameMax = 0;
		for (let i = 0; i < values.length; i++) {
			const magnitude = Math.abs(values[i]);
			if (magnitude > frameMax) frameMax = magnitude;
		}

		// Fast attack, slow release
		peak = frameMax > peak ? frameMax : peak * release;

		const gain = peak > epsilon ? 1 / peak : 0;

		const output = new Array<number>(values.length);
		for (let i = 0; i < values.length; i++) {
			output[i] = Math.pow(clamp01(values[i] * gain), curve);
		}
		return output;
	};
}
