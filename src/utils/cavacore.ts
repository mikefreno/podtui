/**
 * TypeScript FFI bindings for libcavacore.
 *
 * Wraps cava's frequency-analysis engine (cavacore) via Bun's dlopen.
 * The precompiled shared library ships in src/native/ (dev) and dist/ (prod)
 * with fftw3 statically linked — zero native dependencies for end users.
 *
 * Usage:
 * ```ts
 * const cava = loadCavaCore()
 * if (cava) {
 *   cava.init({ bars: 32, sampleRate: 44100 })
 *   const freqs = cava.execute(pcmSamples)
 *   cava.destroy()
 * }
 * ```
 */

import { dlopen, FFIType, ptr } from "bun:ffi";
import { existsSync } from "fs";
import { join, dirname } from "path";

// ── Types ────────────────────────────────────────────────────────────

export interface CavaCoreConfig {
	/** Number of frequency bars (default: 32) */
	bars?: number;
	/** Audio sample rate in Hz (default: 44100) */
	sampleRate?: number;
	/** Number of audio channels (default: 1 = mono) */
	channels?: number;
	/** Automatic sensitivity: 1 = enabled, 0 = disabled (default: 1) */
	autosens?: number;
	/** Noise reduction factor 0.0–1.0 (default: 0.77) */
	noiseReduction?: number;
	/** Low frequency cutoff in Hz (default: 50) */
	lowCutOff?: number;
	/** High frequency cutoff in Hz (default: 10000) */
	highCutOff?: number;
	/** Output scaling mode: 0 = linear (default), 1 = decibel */
	scalingMode?: number;
}

const DEFAULTS: Required<CavaCoreConfig> = {
	bars: 32,
	sampleRate: 44100,
	channels: 1,
	autosens: 1,
	noiseReduction: 0.77,
	lowCutOff: 50,
	highCutOff: 10000,
	scalingMode: 0,
};

type CavaLib = {
	symbols: Record<string, (...args: any[]) => any>;
	close(): void;
};

// ── Library resolution ───────────────────────────────────────────────

function findLibrary(): string | null {
	const platform = process.platform;
	const libName =
		platform === "darwin"
			? "libcavacore.dylib"
			: platform === "win32"
				? "cavacore.dll"
				: "libcavacore.so";

	// Candidate paths, in priority order:
	// 1. src/native/ (development)
	// 2. Same directory as the running executable (dist bundle)
	// 3. dist/ relative to cwd
	const candidates = [
		join(import.meta.dir, "..", "native", libName),
		join(dirname(process.execPath), libName),
		join(process.cwd(), "dist", libName),
	];

	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}

	return null;
}

// ── CavaCore class ───────────────────────────────────────────────────

export class CavaCore {
	private lib: CavaLib;
	private plan: ReturnType<CavaLib["symbols"]["cava_init"]> | null = null;
	private inputBuffer: Float64Array | null = null;
	private outputBuffer: Float64Array | null = null;
	private _bars = 0;
	private _channels = 1;
	private _destroyed = false;

	/** Use loadCavaCore() instead of constructing directly. */
	constructor(lib: CavaLib) {
		this.lib = lib;
	}

	get bars(): number {
		return this._bars;
	}

	/** Whether this instance has been initialized (and not yet destroyed). */
	get isReady(): boolean {
		return this.plan !== null && !this._destroyed;
	}

	/**
	 * Initialize the cavacore engine with the given configuration.
	 * Must be called before execute(). Can be called again after destroy()
	 * to reinitialize with different parameters.
	 */
	init(config: CavaCoreConfig = {}): void {
		if (this.plan) {
			this.destroy();
		}

		const cfg = { ...DEFAULTS, ...config };
		this._bars = cfg.bars;
		this._channels = cfg.channels;

		this.plan = this.lib.symbols.cava_init(
			cfg.bars,
			cfg.sampleRate,
			cfg.channels,
			cfg.autosens,
			cfg.noiseReduction,
			cfg.lowCutOff,
			cfg.highCutOff,
			cfg.scalingMode,
		);

		if (!this.plan) {
			throw new Error("cava_init returned null — initialization failed");
		}

		// Pre-allocate output buffer (bars * channels)
		this.outputBuffer = new Float64Array(cfg.bars * cfg.channels);
		this._destroyed = false;
	}

	/**
	 * Feed PCM samples into cavacore and get frequency bar values back.
	 *
	 * @param samples - Float64Array of PCM samples (scaled ~±32768).
	 *                  The array length determines the number of samples processed.
	 * @returns Float64Array of bar values (0.0–1.0 range, length = bars * channels).
	 *          Returns the same buffer reference each call (overwritten in place).
	 */
	execute(samples: Float64Array): Float64Array {
		if (!this.plan || !this.outputBuffer) {
			throw new Error("CavaCore not initialized — call init() first");
		}

		// Reuse input buffer if same size, otherwise allocate new
		if (!this.inputBuffer || this.inputBuffer.length !== samples.length) {
			this.inputBuffer = new Float64Array(samples.length);
		}
		this.inputBuffer.set(samples);

		this.lib.symbols.cava_execute(
			ptr(this.inputBuffer),
			samples.length,
			ptr(this.outputBuffer),
			this.plan,
		);

		return this.outputBuffer;
	}

	/**
	 * Release all native resources. Safe to call multiple times.
	 * After calling destroy(), init() can be called again to reuse the instance.
	 */
	destroy(): void {
		if (this.plan && !this._destroyed) {
			this.lib.symbols.cava_destroy(this.plan);
			this.plan = null;
			this._destroyed = true;
		}
		this.inputBuffer = null;
		this.outputBuffer = null;
	}
}

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Attempt to load the cavacore shared library and return a CavaCore instance.
 * Returns null if the library cannot be found — callers should fall back
 * to the static waveform display.
 */
export function loadCavaCore(): CavaCore | null {
	try {
		const libPath = findLibrary();
		if (!libPath) return null;

		const lib = dlopen(libPath, {
			cava_init: {
				args: [
					FFIType.i32, // bars
					FFIType.u32, // rate
					FFIType.i32, // channels
					FFIType.i32, // autosens
					FFIType.double, // noise_reduction
					FFIType.i32, // low_cut_off
					FFIType.i32, // high_cut_off
					FFIType.i32, // scaling_mode
				],
				returns: FFIType.ptr,
			},
			cava_execute: {
				args: [
					FFIType.ptr, // cava_in (double*)
					FFIType.i32, // samples
					FFIType.ptr, // cava_out (double*)
					FFIType.ptr, // plan
				],
				returns: FFIType.void,
			},
			cava_destroy: {
				args: [FFIType.ptr], // plan
				returns: FFIType.void,
			},
		});

		return new CavaCore(lib as CavaLib);
	} catch {
		// Library load failed — missing dylib, wrong arch, etc.
		return null;
	}
}
