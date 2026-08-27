/**
 * Terminal recovery for suspend/resume and system sleep/wake cycles.
 *
 * The renderer enters the alternate screen, enables raw mode and attaches its
 * stdin listener exactly once at startup. The diff renderer also keeps
 * `currentRenderBuffer` as its model of what is on screen and only writes the
 * cells that changed against that model.
 *
 * When the session is suspended (Ctrl-Z) or the system sleeps and the process
 * is later resumed, the terminal screen can desync from that model: the stale
 * buffer makes the diff rewrite only "changed" cells, leaving garbled or
 * previous content on screen, and the raw-mode / stdin wiring can be dropped.
 * The result is a frozen, non-interactive screen that shows raw markup instead
 * of the UI.
 *
 * SIGCONT is the standard signal delivered when a stopped process resumes.
 * On it we call `renderer.resume()`, the library's own recovery path, which:
 *   - re-enters the alternate screen (native resumeRenderer)
 *   - re-enables raw mode, re-attaches the stdin listener and flushes stale input
 *   - clears currentRenderBuffer so the next frame performs a full repaint
 */

import type { CliRenderer } from "@opentui/core";

/**
 * Register a SIGCONT handler that recovers the terminal after suspend/resume.
 *
 * @param renderer - the active CLI renderer
 * @returns cleanup function that removes the handler
 */
export function setupTerminalRecovery(renderer: CliRenderer): () => void {
  const onContinue = () => {
    // Best-effort: resume() re-establishes terminal state and forces a full
    // repaint by clearing the render buffer. Idempotent if fired repeatedly.
    try {
      renderer.resume();
    } catch {
      // recovery is best-effort; never crash on the recovery path itself
    }
  };

  process.on("SIGCONT", onContinue);

  return () => {
    process.off("SIGCONT", onContinue);
  };
}
