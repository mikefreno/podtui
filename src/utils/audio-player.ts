/**
 * Audio playback engine for PodTUI.
 *
 * Single backend: mpv — full IPC control (seek, volume, speed, position
 * tracking), so speed/volume/seek changes apply instantly with no process
 * restart. When mpv isn't installed there is no fallback: the no-op backend
 * surfaces "No audio player found" honestly rather than degrading through
 * players that can't change speed/volume without restarting.
 *
 * The backend owns ONE RESIDENT mpv daemon (`--idle=yes --keep-open=yes`)
 * for the app's lifetime instead of spawning a fresh player per episode:
 *
 * - Play/pause/seek are IPC commands on a persistent Unix-socket
 *   connection — no process spawn, no socket connect/disconnect churn per
 *   poll, no `waitForSocket` on the play path. Measured command latency is
 *   single-digit ms; a mid-episode resume after pause takes ~300ms on a
 *   network stream.
 * - State (time-pos, pause, duration) is OBSERVED (`observe_property`):
 *   mpv pushes time-pos at ~20Hz while playing, so `getPosition()` /
 *   `getPauseState()` read a cache instead of round-tripping the socket on
 *   every 150ms UI tick. External pauses (AirPod removal, system sleep,
 *   Now Playing center) arrive as pause property events with zero polling.
 * - A restored session can PRELOAD: the episode is loaded paused so mpv
 *   fills its demuxer cache ahead of time; the first real play just flips
 *   `pause` to false — the ~2s network open is paid at boot, not on the
 *   user's first Play.
 */

import { platform } from "os";
import { existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import type { Socket, Subprocess } from "bun";

// ── Types ────────────────────────────────────────────────────────────

export type BackendName = "mpv" | "none";

export interface AudioState {
	playing: boolean;
	position: number;
	duration: number;
	volume: number;
	speed: number;
	backend: BackendName;
	error: string | null;
}

export interface AudioBackend {
	readonly name: BackendName;
	play(url: string, opts?: PlayOptions): Promise<void>;
	/**
	 * Load the URL paused WITHOUT starting playback, so the player buffers
	 * ahead of the user's first Play (used for boot session restore).
	 * A subsequent play() of the SAME url flips pause off — near-instant.
	 */
	preload(url: string, opts?: PlayOptions): Promise<void>;
	/**
	 * Attach a cover-art image to the currently-loaded file at runtime
	 * (mpv `video-add`). Lets play() start without waiting on art; the
	 * Now Playing artwork pops in when the download lands.
	 */
	addCoverArt(path: string): Promise<void>;
	pause(): Promise<void>;
	resume(): Promise<void>;
	stop(): Promise<void>;
	seek(seconds: number): Promise<void>;
	setVolume(volume: number): Promise<void>;
	setSpeed(speed: number): Promise<void>;
	getPosition(): Promise<number>;
	getDuration(): Promise<number>;
	isPlaying(): boolean;
	/** Live pause state: `true` paused, `false` playing, `undefined` when
	 *  unknown (player unreachable / not yet loaded). Unlike `isPlaying()` —
	 *  which reflects only commands PodTUI sent — this reflects the player's
	 *  real state, including pauses initiated OUTSIDE PodTUI (system
	 *  sleep/lock, AirPod removal, device swap, OS media keys, the Now
	 *  Playing center). */
	getPauseState(): Promise<boolean | undefined>;
	/** True while the player process is running (regardless of pause). */
	isAlive(): boolean;
	dispose(): void;
}

export interface PlayOptions {
	startPosition?: number;
	volume?: number;
	speed?: number;
	mediaTitle?: string;
	coverArtPath?: string;
}

// ── Utilities ────────────────────────────────────────────────────────

function which(cmd: string): string | null {
	const resolved = Bun.which(cmd);
	if (resolved) return resolved;

	if (platform() === "darwin") {
		const candidates = [
			`/opt/homebrew/bin/${cmd}`,
			`/usr/local/bin/${cmd}`,
			`/usr/bin/${cmd}`,
		];
		for (const candidate of candidates) {
			if (existsSync(candidate)) return candidate;
		}
	}

	return null;
}

let mpvInstance = 0;
function mpvSocketPath(): string {
	// Per-instance, not just per-pid: tests (and backend switching) create
	// several MpvBackend objects in ONE bun process — a pid-only path makes
	// every daemon bind the same socket, so later daemons unlink the path
	// out from under earlier ones and IPC cross-talks between backends.
	return join(
		tmpdir(),
		`podtui-mpv-${process.pid}-${mpvInstance++}.sock`,
	);
}

/**
 * mpv executable to use. Prefers a sibling `mpv` inside the app bundle
 * (macOS PodTui.app/Contents/MacOS/mpv): running mpv from inside the bundle
 * makes macOS attribute its Now Playing session to PodTui — source-app icon
 * and name in Control Center — instead of a blank placeholder for an
 * unbundled binary.
 *
 * The bundled copy is verified to actually launch: it links against brew's
 * dylibs by absolute path, and a Homebrew ffmpeg major upgrade can break it
 * (dylib gone → immediate non-zero exit). If the bundled binary can't run,
 * fall back to PATH mpv so audio keeps working — the icon degrades to blank
 * rather than playback dying. Probed once per process.
 */
let resolvedMpv: string | null | undefined; // undefined = not yet probed

function mpvLaunches(binary: string): boolean {
	try {
		const proc = Bun.spawnSync([binary, "--version"], { timeout: 3000 });
		return proc.exitCode === 0;
	} catch {
		return false;
	}
}

function resolveMpvBinary(): string | null {
	if (resolvedMpv !== undefined) return resolvedMpv;
	let resolved: string | null = null;
	try {
		const bundled = join(dirname(process.execPath), "mpv");
		if (existsSync(bundled) && mpvLaunches(bundled)) {
			resolved = bundled;
		}
	} catch {
		/* process.execPath unusable — fall through to PATH */
	}
	if (!resolved) resolved = which("mpv");
	resolvedMpv = resolved;
	return resolved;
}

// ── mpv JSON IPC connection ─────────────────────────────────────────
//
// One persistent Unix-socket connection to the resident mpv daemon. Lines
// from mpv are either command responses (`request_id` present — correlated
// to the pending promise) or unsolicited traffic (property-change events
// from `observe_property`, end-file, ...), dispatched to the event handler.

interface MpvResponse {
	error?: string;
	data?: unknown;
	request_id?: number;
}

interface MpvEvent {
	event: string;
	/** Observation id for property-change events. */
	id?: number;
	name?: string;
	data?: unknown;
	reason?: string;
	error?: string;
}

type MpvEventHandler = (msg: MpvEvent) => void;

class MpvConnection {
	private sock: Socket | null = null;
	private buf = "";
	private nextId = 1;
	private pending = new Map<number, (msg: MpvResponse) => void>();
	private eventWaiters = new Map<string, Array<(msg: MpvEvent) => void>>();
	onEvent: MpvEventHandler = () => {};

	async connect(path: string): Promise<void> {
		const { promise, resolve, reject } = Promise.withResolvers<void>();
		let settled = false;
		Bun.connect({
			unix: path,
			socket: {
				open: (socket) => {
					this.sock = socket;
					if (!settled) {
						settled = true;
						resolve();
					}
				},
				data: (_socket, data) => this.onData(data),
				error: (_socket, err) => {
					if (!settled) {
						settled = true;
						reject(err);
					}
					this.handleTeardown();
				},
				close: () => this.handleTeardown(),
			},
		}).catch((err) => {
			if (!settled) {
				settled = true;
				reject(err);
			}
		});
		await promise;
	}

	private onData(data: Uint8Array): void {
		this.buf += Buffer.from(data).toString();
		let nl = this.buf.indexOf("\n");
		while (nl !== -1) {
			const line = this.buf.slice(0, nl);
			this.buf = this.buf.slice(nl + 1);
			nl = this.buf.indexOf("\n");
			if (!line.trim()) continue;
			let msg: Record<string, unknown>;
			try {
				msg = JSON.parse(line) as Record<string, unknown>;
			} catch {
				continue; // skip malformed lines
			}
			if (msg.request_id !== undefined) {
				const resolve = this.pending.get(msg.request_id as number);
				if (resolve) {
					this.pending.delete(msg.request_id as number);
					resolve(msg as MpvResponse);
				}
			} else if (typeof msg.event === "string") {
				const event = msg as unknown as MpvEvent;
				this.onEvent(event);
				const waiters = this.eventWaiters.get(event.event);
				if (waiters) {
					this.eventWaiters.delete(event.event);
					for (const w of waiters) w(event);
				}
			}
		}
	}

	/** Socket died / daemon gone: fail all pending commands so no caller
	 *  hangs on a dead connection. */
	private handleTeardown(): void {
		for (const resolve of this.pending.values()) {
			resolve({ error: "connection-lost" });
		}
		this.pending.clear();
		this.sock = null;
	}

	/** Send a command and await mpv's response (correlated by request_id).
	 *  Resolves `{ error: "timeout" }` instead of hanging when mpv stalls. */
	send(command: unknown[], timeoutMs = 2000): Promise<MpvResponse> {
		const sock = this.sock;
		if (!sock) return Promise.resolve({ error: "not-connected" });
		const id = this.nextId++;
		const { promise, resolve } = Promise.withResolvers<MpvResponse>();
		const timeout = setTimeout(() => {
			if (this.pending.delete(id)) resolve({ error: "timeout" });
		}, timeoutMs);
		this.pending.set(id, (msg) => {
			clearTimeout(timeout);
			resolve(msg);
		});
		sock.write(JSON.stringify({ command, request_id: id }) + "\n");
		return promise;
	}

	/** One-shot wait for an mpv event by name. Register BEFORE the command
	 *  that triggers it. Resolves null on timeout instead of hanging. */
	waitEvent(name: string, timeoutMs = 5000): Promise<MpvEvent | null> {
		const { promise, resolve } = Promise.withResolvers<MpvEvent | null>();
		const list = this.eventWaiters.get(name) ?? [];
		list.push(resolve);
		this.eventWaiters.set(name, list);
		setTimeout(() => {
			const current = this.eventWaiters.get(name);
			if (current) {
				this.eventWaiters.set(
					name,
					current.filter((w) => w !== resolve),
				);
			}
			resolve(null);
		}, timeoutMs);
		return promise;
	}

	close(): void {
		try {
			this.sock?.end();
		} catch {
			/* ignore */
		}
		this.handleTeardown();
	}
}

// ── mpv Backend ──────────────────────────────────────────────────────
// One resident daemon for the app's lifetime, controlled over a single
// persistent JSON IPC connection with property observation.

/** Property observation ids (correlate property-change events). */
const OBS_TIME_POS = 1;
const OBS_PAUSE = 2;
const OBS_DURATION = 3;
const OBS_EOF = 4;

export class MpvBackend implements AudioBackend {
	readonly name: BackendName = "mpv";
	private proc: Subprocess | null = null;
	private socketPath = mpvSocketPath();
	private conn: MpvConnection | null = null;
	/** Guarantee daemon startup runs once (concurrent play/preload). */
	private startPromise: Promise<void> | null = null;

	// Command intent: what PodTUI asked the player to do.
	private _intentPlaying = false;
	/** The file currently loaded via loadfile (null = idle). */
	private _loadedUrl: string | null = null;
	/** The current file was loadfile'd paused (preload) and not yet played. */
	private _loadedPaused = false;
	/** Set on end-file reason "eof"/"error"; cleared by the next loadfile. */
	private _ended = false;

	// Observed (player-reported) state, pushed by mpv property-change events.
	private _position = 0;
	private _duration = 0;
	/** null until the first pause observation arrives. */
	private _paused: boolean | null = null;

	private _volume = 100;
	private _speed = 1;
	private _exited = false;
	/** Last playback error reported via end-file reason "error". */
	private _playbackError: string | null = null;

	// ── Daemon lifecycle ─────────────────────────────────────────────

	private async ensureDaemon(): Promise<void> {
		if (this.proc && !this._exited && this.conn) return;
		if (this.startPromise) return this.startPromise;
		this.startPromise = this.spawnDaemon().finally(() => {
			this.startPromise = null;
		});
		return this.startPromise;
	}

	private async spawnDaemon(): Promise<void> {
		// Clean up stale socket
		try {
			unlinkSync(this.socketPath);
		} catch {
			/* ignore */
		}

		this.proc = Bun.spawn(
			[
				resolveMpvBinary() ?? "mpv",
				"--no-video",
				"--no-terminal",
				"--really-quiet",
				// Stay alive after finishing/unloading files; PodTUI owns one mpv
				// for its whole session and switches episodes via loadfile.
				"--idle=yes",
				"--keep-open=yes",
				// Cap the demuxer cache. mpv's defaults (150MiB) make it race
				// to fill while a preload sits paused — measured 45MB pulled
				// within 12s of a boot-restore preload, saturating the link
				// exactly when everything else is starting up. ~90s forward
				// target / 40MiB hard cap is a few MB at podcast bitrates:
				// plenty for instant resume + stall resilience.
				"--cache-secs=90",
				"--demuxer-max-bytes=40MiB",
				"--demuxer-max-back-bytes=20MiB",
				`--input-ipc-server=${this.socketPath}`,
			],
			{ stdout: "ignore", stderr: "ignore", stdin: "ignore" },
		);
		this._exited = false;
		this.proc.exited
			.then(() => {
				this._exited = true;
				this._intentPlaying = false;
				this._loadedUrl = null;
				this._paused = null;
			})
			.catch(() => {});

		// mpv creates the socket asynchronously (measured ~600ms cold spawn).
		const start = Date.now();
		while (Date.now() - start < 3000) {
			if (this._exited) break;
			if (existsSync(this.socketPath)) break;
			await new Promise((r) => setTimeout(r, 50));
		}

		const conn = new MpvConnection();
		conn.onEvent = (msg) => this.handleEvent(msg);
		await conn.connect(this.socketPath);
		this.conn = conn;

		// Observe the state the UI polls: mpv then pushes changes at ~20Hz
		// while playing and broadcasts external changes (AirPods pull, OS
		// media keys) with zero polling from our side.
		await this.send(["observe_property", OBS_TIME_POS, "time-pos"]);
		await this.send(["observe_property", OBS_PAUSE, "pause"]);
		await this.send(["observe_property", OBS_DURATION, "duration"]);
		// With --keep-open=yes mpv does NOT emit end-file at natural EOF — it
		// sets eof-reached=true (and pauses at the last frame) instead. That
		// property is the track-end signal; end-file only covers unload/error.
		await this.send(["observe_property", OBS_EOF, "eof-reached"]);
	}

	private async send(
		command: unknown[],
	): Promise<MpvResponse> {
		if (!this.conn) return { error: "not-connected" };
		return this.conn.send(command);
	}

	private handleEvent(msg: MpvEvent): void {
		if (msg.event === "property-change") {
			if (msg.id === OBS_TIME_POS) {
				// `data` is number while playing; unavailable → undefined while
				// idle. Keep last known on transient gaps, reset on idle.
				if (typeof msg.data === "number") this._position = msg.data;
			} else if (msg.id === OBS_PAUSE) {
				if (typeof msg.data === "boolean") this._paused = msg.data;
			} else if (msg.id === OBS_DURATION) {
				if (typeof msg.data === "number" && msg.data > 0) {
					this._duration = msg.data;
				}
			} else if (msg.id === OBS_EOF) {
				// Natural end-of-file (or a brand-new load reporting false).
				this._ended = msg.data === true;
				if (this._ended) this._intentPlaying = false;
			}
			return;
		}

		if (msg.event === "end-file") {
			if (msg.reason === "eof") {
				this._ended = true;
				this._intentPlaying = false;
			} else if (msg.reason === "error") {
				this._ended = true;
				this._intentPlaying = false;
				this._playbackError = msg.error ?? "mpv failed to play the stream";
			}
			return;
		}

		if (msg.event === "file-loaded") {
			this._ended = false;
		}
	}

	// ── File presentation options ────────────────────────────────────
	//
	// force-media-title and cover-art-files are set as global properties
	// BEFORE loadfile (verified: runtime-settable; values containing commas
	// would corrupt the per-file options string). Numbers (volume, speed,
	// start, pause) ride as per-file options on loadfile itself so each
	// loadfile is self-contained.

	private async applyPresentation(opts?: PlayOptions): Promise<void> {
		await this.send([
			"set_property",
			"force-media-title",
			opts?.mediaTitle ?? "",
		]);
		await this.send([
			"set_property",
			"cover-art-files",
			opts?.coverArtPath ?? "",
		]);
	}

	private loadfileOptions(opts: PlayOptions | undefined, paused: boolean): string {
		const parts: string[] = [`pause=${paused ? "yes" : "no"}`];
		if (opts?.startPosition && opts.startPosition > 0) {
			parts.push(`start=${Math.max(0, opts.startPosition)}`);
		}
		const vol = Math.round((opts?.volume ?? 1) * 100);
		if (Number.isFinite(vol)) parts.push(`volume=${vol}`);
		const speed = opts?.speed ?? 1;
		if (Number.isFinite(speed) && speed > 0) parts.push(`speed=${speed}`);
		return parts.join(",");
	}

	/**
	 * Every loadfile (play, preload, replay) runs under this mutex: useAudio
	 * fires the boot preload unawaited, so without serialization a user
	 * pressing Play mid-preload would send loadfile(no-pause) followed by the
	 * in-flight preload's loadfile(pause=yes) — and the stale preload would
	 * pause the file the user just started. The mutex also prevents
	 * presentation options (title/cover) of one episode from interleaving
	 * with the loadfile of another.
	 */
	private loadMutex: Promise<unknown> = Promise.resolve();

	private runLoadExclusive<T>(fn: () => Promise<T>): Promise<T> {
		const result = this.loadMutex.then(fn);
		this.loadMutex = result.catch(() => {});
		return result;
	}

	private async loadFileLocked(
		url: string,
		opts: PlayOptions | undefined,
		paused: boolean,
	): Promise<void> {
		await this.applyPresentation(opts);
		// Paused preload of a mid-episode restore: pass NO start= option and
		// seek while paused instead. mpv defers --start stream work (open,
		// header probe, demuxer seek) until playback begins — measured: the
		// demuxer cache stays EMPTY during the whole preload and the eventual
		// unpause pays 4.3s. A time-pos seek while paused executes at once,
		// so the stream opens and buffers during the preload, and the first
		// real Play is a sub-second unpause.
		const pausedSeek =
			paused && opts?.startPosition && opts.startPosition > 0
				? opts.startPosition
				: null;
		const loadOpts =
			pausedSeek && opts ? { ...opts, startPosition: undefined } : opts;
		// Register the file-loaded waiter BEFORE loadfile: the event can
		// arrive between the command response and listener setup otherwise.
		const fileLoaded = pausedSeek && this.conn ? this.conn.waitEvent("file-loaded") : null;
		const resp = await this.send([
			"loadfile",
			url,
			"replace",
			-1,
			this.loadfileOptions(loadOpts, paused),
		]);
		if (resp.error && resp.error !== "success") {
			throw new Error(`mpv loadfile failed: ${resp.error}`);
		}
		if (pausedSeek) {
			// time-pos sent before file-loaded is silently dropped by mpv
			// (no file yet) — the preload then parked at 0 and the restore
			// position was lost. Wait for the open, then seek.
			await fileLoaded;
			await this.send(["set_property", "time-pos", pausedSeek]);
			this._position = pausedSeek;
		}
		this._loadedUrl = url;
		this._loadedPaused = paused;
		this._ended = false;
		this._playbackError = null;
		this._position = opts?.startPosition ?? 0;
		this._duration = 0;
		this._volume = Math.round((opts?.volume ?? 1) * 100);
		this._speed = opts?.speed ?? 1;
	}

	// ── AudioBackend ─────────────────────────────────────────────────

	async play(url: string, opts?: PlayOptions): Promise<void> {
		await this.ensureDaemon();
		// Mark intent before the mutex: a boot preload queued behind this
		// play checks it and skips its own stale paused-load.
		this._intentPlaying = true;
		await this.runLoadExclusive(async () => {
			// Fast path: this exact URL was PRELOADED paused (boot restore) —
			// mpv has been buffering it since boot, so flipping pause off starts
			// audio ~instantly. Re-acquire the start position only when it
			// moved meaningfully since the preload (progress saved meanwhile).
			if (this._loadedUrl === url && this._loadedPaused && !this._ended) {
				const target = opts?.startPosition ?? this._position;
				if (Math.abs(target - this._position) > 2) {
					await this.send(["set_property", "time-pos", target]);
					this._position = target;
				}
				await this.send([
					"set_property",
					"volume",
					Math.round((opts?.volume ?? 1) * 100),
				]);
				await this.send(["set_property", "speed", opts?.speed ?? 1]);
				if (opts?.coverArtPath) {
					// File is already loaded: cover-art-files only applies at
					// load, so add the art as a runtime albumart track instead.
					await this.send(["set_property", "cover-art-files", opts.coverArtPath]);
					await this.send(["video-add", opts.coverArtPath]);
				}
				if (opts?.mediaTitle) {
					await this.send(["set_property", "force-media-title", opts.mediaTitle]);
				}
				await this.send(["set_property", "pause", false]);
				this._loadedPaused = false;
				return;
			}

			await this.loadFileLocked(url, opts, false);
		});
	}

	async preload(url: string, opts?: PlayOptions): Promise<void> {
		await this.ensureDaemon();
		await this.runLoadExclusive(async () => {
			// Already loaded (paused park, or actively playing because the
			// user pressed Play while this preload was queued — either way
			// the file is in the player and must not be clobbered).
			if (this._loadedUrl === url) return;
			await this.loadFileLocked(url, opts, true);
			this._intentPlaying = false;
		});
	}

	async addCoverArt(path: string): Promise<void> {
		if (!this._loadedUrl) return;
		// Keep the property pointing at the latest art too, so a subsequent
		// loadfile of the same episode carries it.
		await this.send(["set_property", "cover-art-files", path]);
		await this.send(["video-add", path]);
	}

	async pause(): Promise<void> {
		await this.send(["set_property", "pause", true]);
		this._intentPlaying = false;
	}

	async resume(): Promise<void> {
		if (this._ended && this._loadedUrl) {
			// Play pressed on a finished episode: replay from the top.
			this._ended = false;
			const url = this._loadedUrl;
			await this.runLoadExclusive(async () => {
				await this.loadFileLocked(
					url,
					{ volume: this._volume / 100, speed: this._speed },
					false,
				);
			});
			this._intentPlaying = true;
			return;
		}
		if (this._loadedPaused && this._loadedUrl) {
			// Deferred first play of a preloaded file.
			this._loadedPaused = false;
		}
		this._ended = false;
		await this.send(["set_property", "pause", false]);
		this._intentPlaying = true;
	}

	async stop(): Promise<void> {
		if (this.conn && this._loadedUrl) {
			await this.send(["stop"]);
		}
		this._intentPlaying = false;
		this._loadedUrl = null;
		this._loadedPaused = false;
		this._ended = false;
		this._position = 0;
		this._duration = 0;
		await this.send(["set_property", "cover-art-files", ""]);
	}

	async seek(seconds: number): Promise<void> {
		await this.send(["set_property", "time-pos", seconds]);
		this._position = seconds;
	}

	async setVolume(volume: number): Promise<void> {
		const v = Math.round(volume * 100);
		await this.send(["set_property", "volume", v]);
		this._volume = v;
	}

	async setSpeed(speed: number): Promise<void> {
		await this.send(["set_property", "speed", speed]);
		this._speed = speed;
	}

	async getPosition(): Promise<number> {
		// Observed at ~20Hz by mpv — no socket roundtrip on the UI poll.
		return this._position;
	}

	async getDuration(): Promise<number> {
		return this._duration;
	}

	isPlaying(): boolean {
		return this._intentPlaying && this.isAlive() && !this._ended;
	}

	async getPauseState(): Promise<boolean | undefined> {
		if (!this.isAlive() || this._paused === null) return undefined;
		return this._paused;
	}

	isAlive(): boolean {
		return this.proc !== null && !this._exited;
	}

	/** Last mpv playback failure (end-file reason "error"), if any. */
	getPlaybackError(): string | null {
		return this._playbackError;
	}

	dispose(): void {
		const conn = this.conn;
		this.conn = null;
		if (conn) {
			// Ask nicely, then force: dispose runs inside process-exit
			// handlers where awaiting is not guaranteed to complete.
			conn.send(["quit"], 500).catch(() => {});
		}
		if (this.proc) {
			try {
				this.proc.kill();
			} catch {
				/* ignore */
			}
			this.proc = null;
		}
		this._exited = true;
		this._intentPlaying = false;
		try {
			unlinkSync(this.socketPath);
		} catch {
			/* ignore */
		}
	}
}

// ── No-op Backend ────────────────────────────────────────────────────

class NoopBackend implements AudioBackend {
	readonly name: BackendName = "none";
	async play(): Promise<void> {}
	async preload(): Promise<void> {}
	async addCoverArt(): Promise<void> {}
	async pause(): Promise<void> {}
	async resume(): Promise<void> {}
	async stop(): Promise<void> {}
	async seek(): Promise<void> {}
	async setVolume(): Promise<void> {}
	async setSpeed(): Promise<void> {}
	async getPosition(): Promise<number> {
		return 0;
	}
	async getDuration(): Promise<number> {
		return 0;
	}
	isPlaying(): boolean {
		return false;
	}
	async getPauseState(): Promise<boolean | undefined> {
		// Nothing plays on the no-op backend — never externally paused.
		return false;
	}
	isAlive(): boolean {
		return false;
	}
	dispose(): void {}
}

// ── Detection & Factory ──────────────────────────────────────────────

export interface DetectedPlayer {
	name: BackendName;
	path: string | null;
	capabilities: {
		seek: boolean;
		volume: boolean;
		speed: boolean;
		positionTracking: boolean;
	};
}

/** Detect all available audio players on this system. */
export function detectPlayers(): DetectedPlayer[] {
	const players: DetectedPlayer[] = [];

	const mpvPath = resolveMpvBinary();
	if (mpvPath) {
		players.push({
			name: "mpv",
			path: mpvPath,
			capabilities: {
				seek: true,
				volume: true,
				speed: true,
				positionTracking: true,
			},
		});
	}

	return players;
}

/** Create the best available audio backend. */
export function createAudioBackend(preferred?: BackendName): AudioBackend {
	// Testability hook: allow forcing a backend (incl. "none") via env so the
	// harness can run silently during replay and opt into real playback per turn.
	// An explicit `preferred` argument still wins.
	if (!preferred) {
		const envPref = process.env.PODTUI_AUDIO_BACKEND as BackendName | undefined;
		if (envPref && (envPref === "mpv" || envPref === "none")) {
			preferred = envPref;
		}
	}

	if (preferred) {
		const backend = createBackendByName(preferred);
		if (backend) return backend;
	}

	return resolveMpvBinary() ? new MpvBackend() : new NoopBackend();
}

function createBackendByName(name: BackendName): AudioBackend | null {
	switch (name) {
		case "mpv":
			return resolveMpvBinary() ? new MpvBackend() : null;
		case "none":
			return new NoopBackend();
	}
}
