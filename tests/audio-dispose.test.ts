/**
 * Audio backend dispose regression test.
 *
 * The `q` (quit) action routes through `process.exit(0)`, which bypasses
 * Solid's onCleanup (where useAudio's onCleanup disposes the backend). To
 * keep spawned players (mpv) from surviving the host, useAudio
 * registers a `process.on("exit")` handler that synchronously disposes the
 * backend. The exit handler's whole job is "kill the child process", so this
 * test pins the contract directly: a backend holding a real spawned subprocess
 * must have killed it once `dispose()` returns.
 *
 * Uses a real `Bun.spawn(["sleep", "60"])` subprocess as a stand-in for the
 * player process, injected into the (private) `proc` slot of an MpvBackend —
 * mpv is the only real backend, and it uses the kill-on-dispose
 * exercising one is enough to guard the family.
 */
import { test, expect } from "bun:test";
import { MpvBackend } from "../src/utils/audio-player";

test("MpvBackend.dispose() kills the spawned child process", async () => {
	const backend = new MpvBackend();
	// Inject a real long-lived subprocess as if mpv had been spawned.
	const child = Bun.spawn(["sleep", "60"], {
		stdout: "ignore",
		stderr: "ignore",
		stdin: "ignore",
	});
	(backend as unknown as { proc: typeof child }).proc = child;

	// Sanity: the child is alive.
	expect(child.killed).toBe(false);

	backend.dispose();

	// dispose() sent SIGTERM (proc.kill()); wait for the child to exit.
	await child.exited;
	expect(child.killed).toBe(true);
});
