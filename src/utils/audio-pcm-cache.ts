/**
 * Position-indexed PCM cache for visualization.
 *
 * One ffmpeg process decodes the episode's audio at 4x realtime (with an
 * 8s initial burst — fast enough to serve bars and seeks instantly, throttled
 * enough that a remote episode isn't ripped at 84x while mpv is trying to
 * start playback) into an in-memory cache indexed by ABSOLUTE playback time.
 * The renderer then reads the PCM
 * window ending at the player's current position with zero sync machinery:
 * there is no pacing (-readrate), no lead-burst, no decode-head/player
 * drift math, no ring wrap, and nothing that knows or cares about pause,
 * resume, seek, or playback speed — those all collapse to "read at a
 * different position in the cache".
 *
 * Pause/resume contract (the failure mode of the old design):
 * - pauseDecode() kills ffmpeg but KEEPS the cache. Resume reads from it
 *   instantly and resumes the tail decode in the background.
 * - Reads outside decoded coverage (startup, seek into an undecoded hole)
 *   return 0 — the renderer HOLDS the last rendered frame rather than
 *   freezing on a clamped buffer or decaying into junk bars.
 *
 * Seeks into undecoded territory start a fresh SEGMENT (a second decode
 * pass over just that region) — earlier segments stay valid, mp3 decode of
 * the same file is deterministic so abutting segments agree.
 *
 * Memory: 22050 Hz mono s16 ≈ 44 KB/s ≈ 2.6 MB/min. The cache is a
 * SLIDING WINDOW around the playback position — the decode pass stops
 * once it is maxAheadSec ahead of the cursor and segments entirely older
 * than keepBehindSec behind it are dropped (both re-filled/restarted on
 * demand). Steady state is bounded by (maxAheadSec + keepBehindSec) of
 * audio (~40 MB at the defaults) INDEPENDENT of episode length; the old
 * whole-episode cache grew ~160 MB per hour of audio and hit 2.5 GB on
 * long-form episodes. Fully freed on stop(). 22050 Hz covers Nyquist
 * 11 kHz, above the default 10 kHz high-cutoff of the visualizer's FFT
 * config.
 *
 * Downloads via ffmpeg's own http stack with reconnect flags, matching the
 * old reader; local files skip them (ffmpeg rejects http-only options for
 * file inputs).
 */

import type { Subprocess } from "bun";

/** PCM output format constants */
export const PCM_SAMPLE_RATE = 22050;
const BYTES_PER_SAMPLE = 2; // s16le

/** Initial segment capacity: 4 Mi samples ≈ 190 s of audio (8 MB). */
const INITIAL_CAPACITY_SAMPLES = 4 * 1024 * 1024;

/**
 * Gap (seconds) a running decode pass may close on its own before a restart
 * at the seek target is cheaper than waiting: at 4x pacing, 15s of undecoded
 * audio closes in ~4s — about the cost of a network reconnect + range
 * request for a fresh ffmpeg pass. Beyond the gap, restart at the target.
 */
const CLOSE_IN_PLACE_GAP_SEC = 15;

/**
 * Default decode-head budget: the ffmpeg pass pauses once it is this far
 * ahead of the playback cursor. Bounds RAM (~26 MB of s16 at 22050 Hz) AND
 * the network pull — the old cache decoded the whole episode at 4x, so a
 * 3h show pinned ~500 MB (2.5 GB+ for long-form) and dragged the entire
 * remote file even when only the first 10 minutes were listened to. At 4x
 * pacing a refill costs ~150s of background decode, one ffmpeg spawn per
 * ~10 min of playback.
 */
const DEFAULT_DECODE_AHEAD_SEC = 600;

/**
 * Default retention behind the cursor: decoded audio entirely older than
 * this is dropped. Keeps pause/resume and small backward seeks instant
 * without letting the window grow with playback time.
 */
const DEFAULT_KEEP_BEHIND_SEC = 300;

/**
 * Monotonically increasing generation counter.
 * Each startDecode() increments this; the read loop checks it to know
 * if it's been superseded and should bail out.
 */
let globalGeneration = 0;

interface Segment {
	/** Playback seconds where this segment's first sample sits. */
	baseSec: number;
	/** Sample buffer; capacity >= written, doubled on overflow. */
	samples: Int16Array;
	/** Samples written so far (== decoded length of the segment). */
	written: number;
	/** ffmpeg reached stream EOF while writing this segment — nothing more
	 *  will ever arrive after its end. */
	finished: boolean;
}

export interface EpisodePcmCacheOptions {
	/** Audio URL or file path to decode */
	url: string;
	/** Sample rate (default: 22050) */
	sampleRate?: number;
	/** Decode-head budget in seconds ahead of the cursor (default: 600). */
	maxAheadSec?: number;
	/** Retention in seconds behind the cursor (default: 300). */
	keepBehindSec?: number;
}

export class EpisodePcmCache {
	private proc: Subprocess | null = null;
	private segments: Segment[] = [];
	private generation = 0;
	private _decoding = false;
	/** The running pass's segment (base + frontier); null when idle. */
	private activeSegment: Segment | null = null;
	readonly url: string;
	readonly sampleRate: number;
	/** Sliding-window budgets (see maintainWindow). */
	readonly maxAheadSec: number;
	readonly keepBehindSec: number;

	constructor(options: EpisodePcmCacheOptions) {
		this.url = options.url;
		this.sampleRate = options.sampleRate ?? PCM_SAMPLE_RATE;
		this.maxAheadSec = options.maxAheadSec ?? DEFAULT_DECODE_AHEAD_SEC;
		this.keepBehindSec = options.keepBehindSec ?? DEFAULT_KEEP_BEHIND_SEC;
	}

	/** Whether an ffmpeg decode pass is currently running. */
	get decoding(): boolean {
		return this._decoding;
	}

	/** Base (playback seconds) of the running decode pass; null when idle. */
	get activeDecodeBaseSec(): number | null {
		return this._decoding && this.activeSegment
			? this.activeSegment.baseSec
			: null;
	}

	/** End (playback seconds) of the furthest-decoded segment. */
	get coverageEndSec(): number {
		let end = 0;
		for (const seg of this.segments) {
			const segEnd = seg.baseSec + seg.written / this.sampleRate;
			if (segEnd > end) end = segEnd;
		}
		return end;
	}

	/** Whether the furthest segment finished at stream EOF. */
	get decodeFinished(): boolean {
		let maxEnd = -1;
		let finished = false;
		for (const seg of this.segments) {
			const segEnd = seg.baseSec + seg.written / this.sampleRate;
			if (segEnd > maxEnd) {
				maxEnd = segEnd;
				finished = seg.finished;
			}
		}
		return finished;
	}

	/**
	 * Start decoding at `fromSec` of playback time into a fresh segment.
	 * Kills any in-flight pass first; existing segments stay readable.
	 */
	startDecode(fromSec: number): void {
		this.killProcess();

		if (!Bun.which("ffmpeg")) {
			throw new Error("ffmpeg not found — required for audio visualization");
		}

		this.generation = ++globalGeneration;
		const myGeneration = this.generation;

		const segment: Segment = {
			baseSec: Math.max(0, fromSec),
			samples: new Int16Array(INITIAL_CAPACITY_SAMPLES),
			written: 0,
			finished: false,
		};
		this.segments.push(segment);

		const args = ["ffmpeg", "-loglevel", "quiet"];

		// Pace the decode at 4x realtime (with an 8s initial burst) instead of
		// flat-out: unthrottled decode measures ~84x realtime, which pulls the
		// ENTIRE episode from the network within the first minute of playback
		// (~160MB/hr) and starves mpv's own buffering right at startup. 4x
		// still fills the cache 4x faster than playback consumes it, lands a
		// 75-min episode in ~19 min of background work, and the burst makes
		// the first bars available immediately.
		args.push("-readrate", "4", "-readrate_initial_burst", "8");

		// `-reconnect*` are http-protocol options: ffmpeg rejects them at
		// input-open when the input is a local file, killing the process
		// before any PCM is produced. Only pass them for network URLs.
		if (/^https?:\/\//i.test(this.url)) {
			args.push(
				"-reconnect",
				"1",
				"-reconnect_streamed",
				"1",
				"-reconnect_delay_max",
				"5",
			);
		}

		// Seek before input for network efficiency (container-level skip is
		// near-instant for mp3/aac; no pre-position decode burn).
		if (fromSec > 0) {
			args.push("-ss", String(Math.max(0, fromSec)));
		}

		args.push(
			"-i",
			this.url,
			"-ac",
			"1",
			"-ar",
			String(this.sampleRate),
			"-f",
			"s16le",
			"-acodec",
			"pcm_s16le",
			"-",
		);

		this.proc = Bun.spawn(args, {
			stdout: "pipe",
			stderr: "ignore",
			stdin: "ignore",
		});
		this._decoding = true;
		this.activeSegment = segment;
		this.readLoop(myGeneration, segment);

		this.proc.exited
			.then((code) => {
				if (this.generation === myGeneration) {
					this._decoding = false;
					this.activeSegment = null;
					// Exit 0 == decoded to stream EOF.
					if (code === 0) segment.finished = true;
				}
			})
			.catch(() => {
				if (this.generation === myGeneration) {
					this._decoding = false;
					this.activeSegment = null;
				}
			});
	}

	/**
	 * Whether `sec` of playback time has decoded PCM on hand.
	 */
	covers(sec: number): boolean {
		const idx = Math.round(sec * this.sampleRate);
		for (const seg of this.segments) {
			const base = Math.round(seg.baseSec * this.sampleRate);
			if (idx >= base && idx < base + seg.written) return true;
		}
		return false;
	}

	/**
	 * Make sure decode is progressing toward `sec`: no-op while a pass is
	 * running or the episode is fully decoded; otherwise resumes the tail
	 * decode from the frontier (when `sec` is inside coverage) or starts a
	 * new segment at `sec` (seek into a hole / resume past cached audio).
	 */
	ensureDecodeAround(sec: number): void {
		// Enforce the sliding-window budget first (head cap, prune, refill)
		// so a resume or seek never leaves stale segments behind the cursor.
		this.maintainWindow(sec);

		// Data already on hand: nothing needed here; only keep the tail
		// filling if the decode is idle, the episode is unfinished, AND the
		// head is inside its budget. A head-capped cache ("we're maxAheadSec
		// ahead, enough decoded") is NOT a stalled decode — restarting it
		// here would fight maintainWindow's cap on every resume call.
		if (this.covers(sec)) {
			if (this._decoding || this.decodeFinished) return;
			const end = this.coverageEndSec;
			if (end >= sec + this.maxAheadSec) return;
			this.startDecode(end > sec ? end : sec);
			return;
		}

		if (this._decoding && this.activeSegment !== null) {
			// A decode pass fills monotonically FORWARD from its base. Targets
			// behind the base are unreachable — restart at the target.
			if (sec < this.activeSegment.baseSec) {
				this.startDecode(Math.max(0, sec));
				return;
			}
			// Target past the pass's frontier: a SMALL gap closes on its own
			// (4x pacing covers 15s in ~4s — about what a cold restart costs
			// to reconnect + range-request a network stream), but a FAR-FORWARD
			// seek would otherwise mean minutes of frozen bars while the pass
			// chews through the skipped region. Restart at the target.
			const frontier =
				this.activeSegment.baseSec + this.activeSegment.written / this.sampleRate;
			if (sec - frontier <= CLOSE_IN_PLACE_GAP_SEC) return;
		}
		this.startDecode(Math.max(0, sec));
	}

	/**
	 * Sliding-window budget for the in-memory cache, driven by the live
	 * playback position. Runs on every read (the render loop is the only
	 * consumer that knows the cursor continuously) and on resume/seek:
	 * - capHead: the decode pass pauses once it is maxAheadSec ahead of the
	 *   cursor (pauseDecode keeps the decoded data — a plain startDecode
	 *   from the frontier refills it later).
	 * - prune: segments entirely keepBehindSec behind the cursor are
	 *   dropped. A backward seek past the window restarts a segment there —
	 *   the same mechanism as a seek into an undecoded hole, so no new
	 *   failure mode.
	 * - topUp: when the cursor has outrun the head, restart the tail decode
	 *   from the frontier (one ffmpeg spawn per maxAheadSec of playback).
	 * Together these bound memory to (maxAheadSec + keepBehindSec) of audio
	 * regardless of episode length.
	 */
	private maintainWindow(atSec: number): void {
		const pos = Math.max(0, atSec);

		if (this._decoding && this.coverageEndSec >= pos + this.maxAheadSec) {
			this.pauseDecode();
		}

		const keepFromSec = pos - this.keepBehindSec;
		if (
			this.segments.some(
				(seg) => seg.baseSec + seg.written / this.sampleRate < keepFromSec,
			)
		) {
			this.segments = this.segments.filter(
				(seg) => seg.baseSec + seg.written / this.sampleRate >= keepFromSec,
			);
		}

		if (!this._decoding && !this.decodeFinished) {
			const end = this.coverageEndSec;
			if (end < pos + this.maxAheadSec) {
				this.startDecode(Math.max(end, pos));
			}
		}
	}

	/**
	 * Read the PCM window ENDING at `atSec` of playback into `out`
	 * (Int16 magnitudes widened to f64, the scale cavacore expects).
	 *
	 * Returns the number of samples written: `out.length` on a full hit, 0
	 * when the window is not (fully) decoded yet — the caller HOLDS the
	 * last rendered frame instead of rendering partial/stale data.
	 */
	readWindow(out: Float64Array, atSec: number): number {
		if (out.length === 0) return 0;
		this.maintainWindow(atSec);
		const endIdx = Math.round(atSec * this.sampleRate);
		const startIdx = endIdx - out.length + 1;
		for (const seg of this.segments) {
			const base = Math.round(seg.baseSec * this.sampleRate);
			if (startIdx < base || endIdx >= base + seg.written) continue;
			const rel = startIdx - base;
			const src = seg.samples;
			for (let i = 0; i < out.length; i++) {
				out[i] = src[rel + i];
			}
			return out.length;
		}
		return 0;
	}

	/**
	 * Pause contract: kill the ffmpeg pass but KEEP every decoded segment.
	 * Resume later serves bars from the cache instantly.
	 */
	pauseDecode(): void {
		this.generation = ++globalGeneration;
		this._decoding = false;
		this.activeSegment = null;
		this.killProcess();
	}

	/** Kill the decode pass AND drop all cached audio. */
	stop(): void {
		this.pauseDecode();
		this.segments = [];
	}

	/** Kill the ffmpeg process without touching generation/state. */
	private killProcess(): void {
		if (this.proc) {
			try {
				this.proc.kill();
			} catch {
				/* ignore */
			}
			this.proc = null;
		}
	}

	/** Internal: continuously reads stdout from ffmpeg and appends samples
	 *  to the segment at their absolute playback-time offsets. */
	private async readLoop(myGeneration: number, segment: Segment): Promise<void> {
		const stdout = this.proc?.stdout;
		if (!stdout || typeof stdout === "number") return;

		const reader = (stdout as ReadableStream<Uint8Array>).getReader();
		// s16 sample pairs can straddle pipe chunk boundaries: carry a lone
		// trailing byte into the next chunk (dropping it would byte-flip
		// every sample that follows).
		let carry: number | null = null;
		try {
			while (this.generation === myGeneration) {
				const { done, value } = await reader.read();
				if (done || this.generation !== myGeneration) break;
				if (!value || value.byteLength === 0) continue;

				let view: Uint8Array = value;
				if (carry !== null) {
					const merged = new Uint8Array(1 + value.byteLength);
					merged[0] = carry;
					merged.set(value, 1);
					view = merged;
					carry = null;
				}
				if (view.byteLength % BYTES_PER_SAMPLE !== 0) {
					carry = view[view.byteLength - 1];
					view = view.subarray(0, view.byteLength - 1);
				}

				const sampleCount = view.byteLength / BYTES_PER_SAMPLE;
				if (sampleCount === 0) continue;

				if (segment.written + sampleCount > segment.samples.length) {
					const grown = new Int16Array(
						Math.max(
							segment.samples.length * 2,
							segment.written + sampleCount,
						),
					);
					grown.set(segment.samples.subarray(0, segment.written));
					segment.samples = grown;
				}
				// Int16Array view over the byte buffer: s16le is the platform's
				// native endianness on every supported target (arm64/x64 are LE).
				const src = new Int16Array(
					view.buffer,
					view.byteOffset,
					sampleCount,
				);
				segment.samples.set(src, segment.written);
				segment.written += sampleCount;
			}
		} catch {
			// Stream ended or process killed — expected during stop()
		} finally {
			try {
				reader.releaseLock();
			} catch {
				/* ignore */
			}
		}
	}
}
