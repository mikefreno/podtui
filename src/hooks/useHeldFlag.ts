/**
 * useHeldFlag — keep a boolean true for a minimum time after it falls.
 *
 * A warm-cache fetch-more load begins and ends between two renderer
 * frames: the raw `isLoadingMore` signal flips true→false without a
 * single paint, so the "[Fetch More]" → spinner swap never appears and
 * the press looks like a no-op. Components rendering a spinner for such
 * bursts read through this hook instead of the raw signal — the spinner
 * stays up (and animating) for at least `minMs` after the load ends,
 * guaranteeing several painted frames.
 *
 * Deliberately a display-layer concern: the store's own `isLoadingMore`
 * keeps its exact load-window semantics (guards, tests) and only the
 * rendered indicators are held.
 */
import { createSignal, createEffect, onCleanup } from "solid-js";

export function useHeldFlag(
 source: () => boolean,
 minMs = 250,
): () => boolean {
 const [held, setHeld] = createSignal(false);
 let timer: ReturnType<typeof setTimeout> | null = null;
 const clearTimer = () => {
  if (timer) {
   clearTimeout(timer);
   timer = null;
  }
 };

 createEffect(() => {
  if (source()) {
   // (Re)rising edge: show immediately; a pending fall from an
   // earlier burst is cancelled.
   clearTimer();
   if (!held()) setHeld(true);
  } else if (held()) {
   // Falling edge: hold the flag up for the remaining window.
   clearTimer();
   timer = setTimeout(() => setHeld(false), minMs);
  }
 });

 onCleanup(clearTimer);
 return held;
}
