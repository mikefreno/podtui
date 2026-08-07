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
import { join } from "path";

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
	dispose(): void;
}

export interface PlayOptions {
	startPosition?: number;
	volume?: number;
	speed?: number;
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

// ── mpv Backend ──────────────────────────────────────────────────────
// Uses JSON IPC over a Unix socket for full bidirectional control.

export class MpvBackend implements AudioBackend {
	readonly name: BackendName = "mpv";
	private proc: ReturnType<typeof Bun.spawn> | null = null;
	private socketPath = mpvSocketPath();
	private _playing = false;
	private _position = 0;
	private _duration = 0;
	private _volume = 100;
	private _speed = 1;
	private pollTimer: ReturnType<typeof setInterval> | null = null;

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
			"mpv",
			"--no-video",
			"--no-terminal",
			"--really-quiet",
			`--input-ipc-server=${this.socketPath}`,
			`--volume=${Math.round((opts?.volume ?? 1) * 100)}`,
			`--speed=${opts?.speed ?? 1}`,
		];

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
		this._position = opts?.startPosition ?? 0;
		this._volume = Math.round((opts?.volume ?? 1) * 100);
		this._speed = opts?.speed ?? 1;

		// Wait for socket to appear (mpv creates it async)
		await this.waitForSocket(2000);

		// Start polling position
		this.startPolling();

		// Detect process exit
		this.proc.exited
			.then(() => {
				this._playing = false;
				this.stopPolling();
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

	private async ipc(command: unknown[]): Promise<unknown> {
		try {
			const socket = await Bun.connect({
				unix: this.socketPath,
				socket: {
					data(_socket, data) {
						// Response handling is done by reading below
					},
					error(_socket, err) {},
					close() {},
					open() {},
				},
			});

			const payload = JSON.stringify({ command }) + "\n";
			socket.write(payload);

			// Read response with timeout
			const response = await new Promise<string>((resolve) => {
				let buf = "";
				const reader = setInterval(() => {
					// Check if we got a response already
					if (buf.includes("\n")) {
						clearInterval(reader);
						resolve(buf);
					}
				}, 10);
				setTimeout(() => {
					clearInterval(reader);
					resolve(buf);
				}, 200);
			});

			socket.end();
			if (response) {
				try {
					return JSON.parse(response.split("\n")[0]);
				} catch {
					return null;
				}
			}
			return null;
		} catch {
			return null;
		}
	}

	/** Send a command over mpv's IPC and get the parsed response data. */
	private async ipcCommand(command: unknown[]): Promise<unknown> {
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

			const payload = JSON.stringify({ command }) + "\n";
			conn.write(payload);

			// Give mpv a moment to process, then read via a fresh connection
			await new Promise((r) => setTimeout(r, 30));
			conn.end();

			return null;
		} catch {
			return null;
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

	/** Get a property value from mpv via IPC */
	private async getProperty(name: string): Promise<number> {
		try {
			return await new Promise<number>((resolve) => {
				let result = 0;
				const timeout = setTimeout(() => resolve(result), 300);

				Bun.connect({
					unix: this.socketPath,
					socket: {
						data(_socket, data) {
							try {
								const text = Buffer.from(data).toString();
								const parsed = JSON.parse(text.split("\n")[0]);
								if (parsed?.data !== undefined) {
									result = Number(parsed.data) || 0;
								}
							} catch {
								/* ignore parse errors */
							}
							clearTimeout(timeout);
							resolve(result);
						},
						error() {
							clearTimeout(timeout);
							resolve(0);
						},
						close() {},
						open(socket) {
							socket.write(
								JSON.stringify({ command: ["get_property", name] }) + "\n",
							);
						},
					},
				}).catch(() => {
					clearTimeout(timeout);
					resolve(0);
				});
			});
		} catch {
			return 0;
		}
	}

	private startPolling(): void {
		this.stopPolling();
		this.pollTimer = setInterval(async () => {
			if (!this._playing || !this.proc) return;
			this._position = await this.getProperty("time-pos");
			if (this._duration <= 0) {
				this._duration = await this.getProperty("duration");
			}
		}, 500);
	}

	private stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
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
		this.stopPolling();
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
		return this._position;
	}

	async getDuration(): Promise<number> {
		if (this._duration <= 0) {
			this._duration = await this.getProperty("duration");
		}
		return this._duration;
	}

	isPlaying(): boolean {
		return this._playing;
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

	const mpvPath = which("mpv");
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

	return which("mpv") ? new MpvBackend() : new NoopBackend();
}

function createBackendByName(name: BackendName): AudioBackend | null {
	switch (name) {
		case "mpv":
			return which("mpv") ? new MpvBackend() : null;
		case "none":
			return new NoopBackend();
	}
}
