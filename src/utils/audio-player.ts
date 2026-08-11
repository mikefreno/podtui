/**
 * Audio playback engine for PodTUI.
 *
 * Single backend: mpv — full IPC control (seek, volume, speed, position
 * tracking), so speed/volume/seek changes apply instantly with no process
 * restart. When mpv isn't installed there is no fallback: the no-op backend
 * surfaces "No audio player found" honestly rather than degrading through
 * players that can't change speed/volume without restarting.
 */

import { platform } from "os";
import { existsSync } from "fs";
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
	 *  the read failed (callers keep the last known state). Unlike
	 *  `isPlaying()` — which reflects only commands PodTUI sent — this
	 *  reflects the player's real state, including pauses initiated
	 *  OUTSIDE PodTUI (system sleep/lock, AirPod removal, device swap,
	 *  OS media keys, the Now Playing center). */
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

function mpvSocketPath(): string {
	return join(tmpdir(), `podtui-mpv-${process.pid}.sock`);
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

// ── mpv Backend ──────────────────────────────────────────────────────
// Uses JSON IPC over a Unix socket for full bidirectional control.

export class MpvBackend implements AudioBackend {
	readonly name: BackendName = "mpv";
	private proc: Subprocess | null = null;
	private socketPath = mpvSocketPath();
	private _playing = false;
	private _position = 0;
	private _duration = 0;
	private _volume = 100;
	private _speed = 1;
	private _exited = false;

	async play(url: string, opts?: PlayOptions): Promise<void> {
		await this.stop();

		// Clean up stale socket
		try {
			if (existsSync(this.socketPath)) {
				const { unlinkSync } = await import("fs");
				unlinkSync(this.socketPath);
			}
		} catch {
			/* ignore */
		}

		const args = [
			resolveMpvBinary() ?? "mpv",
			"--no-video",
			"--no-terminal",
			"--really-quiet",
			`--input-ipc-server=${this.socketPath}`,
			`--volume=${Math.round((opts?.volume ?? 1) * 100)}`,
			`--speed=${opts?.speed ?? 1}`,
		];

		if (opts?.mediaTitle) {
			args.push(`--force-media-title=${opts.mediaTitle}`);
		}

		if (opts?.coverArtPath) {
			// Explicit cover file → albumart track → macOS Now Playing artwork
			// (works for remote streams, not just local downloads).
			args.push(`--cover-art-files=${opts.coverArtPath}`);
		}

		if (opts?.startPosition && opts.startPosition > 0) {
			args.push(`--start=${opts.startPosition}`);
		}

		args.push(url);

		this.proc = Bun.spawn(args, {
			stdout: "ignore",
			stderr: "ignore",
			stdin: "ignore",
		});

		this._playing = true;
		this._exited = false;
		this._position = opts?.startPosition ?? 0;
		this._volume = Math.round((opts?.volume ?? 1) * 100);
		this._speed = opts?.speed ?? 1;

		// Wait for socket to appear (mpv creates it async)
		await this.waitForSocket(2000);

		// Position is fetched live from mpv on each getPosition() call (see
		// below) — the UI polls it, so no internal poll timer is needed.

		// Detect process exit
		this.proc.exited
			.then(() => {
				this._playing = false;
				this._exited = true;
			})
			.catch(() => {});
	}

	private async waitForSocket(timeoutMs: number): Promise<void> {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			if (existsSync(this.socketPath)) return;
			await new Promise((r) => setTimeout(r, 50));
		}
	}

	/** Send a fire-and-forget command (no response needed) */
	private async send(command: unknown[]): Promise<void> {
		try {
			const conn = await Bun.connect({
				unix: this.socketPath,
				socket: {
					data() {},
					error() {},
					close() {},
					open() {},
				},
			});
			conn.write(JSON.stringify({ command }) + "\n");
			// Don't wait, just schedule a close
			setTimeout(() => {
				try {
					conn.end();
				} catch {}
			}, 50);
		} catch {
			/* ignore */
		}
	}

	/**
	 * Get a property value from mpv via IPC.
	 *
	 * Resolves the parsed numeric value, or `undefined` when the read fails
	 * (socket error, timeout, unparseable response, or the property being
	 * unavailable — e.g. `time-pos` before playback starts). Failure is
	 * distinct from a legitimate `0` so callers can keep the last known
	 * value instead of snapping the position clock to zero on a transient
	 * error; the next poll retries.
	 *
	 * mpv multiplexes unsolicited events (audio-reconfig, file-loaded, ...)
	 * onto the same connection, so we line-buffer and only settle on the
	 * line that carries the command response (`request_id` set). The socket
	 * is closed once the response is handled — leaving it open leaks an fd
	 * per poll, while closing it before mpv processes the request drops the
	 * reply.
	 */
	private async getProperty(name: string): Promise<number | undefined> {
		try {
			return await new Promise<number | undefined>((resolve) => {
				let settled = false;
				let sock: Socket | null = null;
				let buf = "";
				const done = (value: number | undefined) => {
					if (settled) return;
					settled = true;
					clearTimeout(timeout);
					try {
						sock?.end();
					} catch {
						/* ignore */
					}
					resolve(value);
				};
				const timeout = setTimeout(() => done(undefined), 300);

				Bun.connect({
					unix: this.socketPath,
					socket: {
						open(socket) {
							sock = socket;
							socket.write(
								JSON.stringify({ command: ["get_property", name] }) + "\n",
							);
						},
						data(_socket, data) {
							buf += Buffer.from(data).toString();
							let nl = buf.indexOf("\n");
							while (nl !== -1) {
								const line = buf.slice(0, nl);
								buf = buf.slice(nl + 1);
								nl = buf.indexOf("\n");
								try {
									const parsed = JSON.parse(line);
									// Events carry no request_id; only settle on
									// the actual command response.
									if (parsed?.request_id === undefined) continue;
									if (parsed?.data !== undefined) {
										done(Number(parsed.data) || 0);
									} else {
										done(undefined);
									}
									return;
								} catch {
									/* skip malformed lines */
								}
							}
						},
						error() {
							done(undefined);
						},
						close() {
							done(undefined);
						},
					},
				}).catch(() => done(undefined));
			});
		} catch {
			return undefined;
		}
	}

	async pause(): Promise<void> {
		await this.send(["set_property", "pause", true]);
		this._playing = false;
	}

	async resume(): Promise<void> {
		await this.send(["set_property", "pause", false]);
		this._playing = true;
	}

	async stop(): Promise<void> {
		if (this.proc) {
			try {
				this.proc.kill();
			} catch {
				/* ignore */
			}
			this.proc = null;
		}
		this._playing = false;
		this._position = 0;

		// Clean up socket
		try {
			if (existsSync(this.socketPath)) {
				const { unlinkSync } = await import("fs");
				unlinkSync(this.socketPath);
			}
		} catch {
			/* ignore */
		}
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
		// Live-fetch `time-pos` so the position clock is as fresh as the
		// UI's poll rate (the hook polls this at ~150ms). On a transient IPC
		// failure, keep the last known value rather than returning 0.
		if (this._playing && this.proc) {
			const pos = await this.getProperty("time-pos");
			if (pos !== undefined) this._position = pos;
		}
		return this._position;
	}

	async getDuration(): Promise<number> {
		if (this._duration <= 0) {
			const dur = await this.getProperty("duration");
			if (dur !== undefined && dur > 0) this._duration = dur;
		}
		return this._duration;
	}

	isPlaying(): boolean {
		return this._playing;
	}

	async getPauseState(): Promise<boolean | undefined> {
		if (!this.isAlive()) return undefined;
		const p = await this.getProperty("pause");
		if (p === undefined) return undefined;
		return p === 1;
	}

	isAlive(): boolean {
		return this.proc !== null && !this._exited;
	}

	dispose(): void {
		this.stop();
	}
}

// ── No-op Backend ────────────────────────────────────────────────────

class NoopBackend implements AudioBackend {
	readonly name: BackendName = "none";
	async play(): Promise<void> {}
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
