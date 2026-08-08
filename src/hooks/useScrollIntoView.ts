/**
 * useScrollIntoView — keeps the ref'd row visible inside its enclosing
 * `<scrollbox>` whenever the focus accessor is true.
 *
 * OpenTUI's `ScrollBoxRenderable` has built-in *keyboard* scrolling but does
 * NOT auto-scroll to follow a programmatically-focused child (the app moves
 * its own cursor via the yazi nav store, so the scrollbox never sees a key
 * for row movement). Every scrollable panel therefore drifts out of view the
 * moment the cursor crosses the viewport edge.
 *
 * Attach the returned `ref` callback to the element that represents the
 * focused row of a scrollable list and call the hook with a `when()` that is
 * true for exactly that row (e.g. `() => index() === focus()`). Whenever the
 * accessor flips true, the nearest ScrollBoxRenderable is scrolled just enough
 * to bring the element back into the viewport — a "nearest-edge" scroll:
 *   • scroll up only if the row's top is clipped above the viewport,
 *   • scroll down only if the row's bottom is clipped below the viewport,
 * never snapping more than necessary (matches yazi list behaviour).
 *
 * Timing: for ordinary cursor movement (j/k) the list layout does not change
 * — only background colour and the cursor glyph flip — so the focused row's
 * Yoga-computed position is already valid when this effect fires, and the
 * scroll is applied synchronously. On first mount / content population the
 * layout for the new rows has not yet been computed, so the hook polls on a
 * short timer until layout resolves (bounded so it can never loop forever).
 */
import { createEffect, onCleanup } from "solid-js";

/** Walk up the renderable parent chain to the nearest ScrollBoxRenderable,
 *  identified by its `viewport` + `content` + numeric `scrollTop`. */
function findScrollBox(node: any): any | null {
	let p: any = node?.parent;
	while (p) {
		if (p.viewport && p.content && typeof p.scrollTop === "number") return p;
		p = p.parent;
	}
	return null;
}

/** Maximum number of retries while waiting for Yoga layout to populate the
 *  row/viewport dimensions (handles the first-mount frame). */
const MAX_RETRIES = 12;
const RETRY_MS = 16;

export function useScrollIntoView(when: () => boolean) {
	let el: any = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	const ref = (node: any) => {
		el = node;
	};

	const clearTimer = () => {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	};

	/** Compute the target scrollTop that brings `el` into the viewport of its
	 *  enclosing scrollbox, or `null` if no scroll is possible / needed yet.
	 *  Returns the decision so the caller knows whether to poll again. */
	const compute = (): { scroll: number | null; ready: boolean } => {
		const node = el;
		if (!node) return { scroll: null, ready: false };
		const sb = findScrollBox(node);
		if (!sb) return { scroll: null, ready: false };
		const vp = sb.viewport;
		const top: number = sb.scrollTop ?? 0;
		const vpH: number = vp?.height ?? 0;
		// The scrollbar's onChange sets `content.translateY = -scrollTop`, so
		// the child's cumulative `.y` already includes `-scrollTop`; subtracting
		// the viewport's stable `.y` and re-adding `scrollTop` recovers the
		// row's layout-space offset within the content (scroll-independent).
		const childTop: number = node.y ?? 0;
		const childH: number = node.height ?? 0;
		if (!vpH || !childH) return { scroll: null, ready: false };

		const offset = childTop - (vp.y ?? 0) + top;
		let target = top;
		if (offset < top) target = offset;
		else if (offset + childH > top + vpH) target = offset + childH - vpH;
		const max = Math.max(0, (sb.scrollHeight ?? 0) - vpH);
		if (target > max) target = max;
		if (target < 0) target = 0;
		target = Math.round(target);
		if (target === Math.round(top)) return { scroll: null, ready: true };
		return { scroll: target, ready: true };
	};

	const tryScroll = (retriesLeft: number) => {
		const { scroll, ready } = compute();
		if (!ready) {
			if (retriesLeft > 0)
				timer = setTimeout(() => tryScroll(retriesLeft - 1), RETRY_MS);
			return;
		}
		if (scroll != null) {
			const sb = findScrollBox(el);
			if (sb) sb.scrollTo(scroll);
		}
		clearTimer();
	};

	createEffect(() => {
		if (!when()) return;
		clearTimer();
		tryScroll(MAX_RETRIES);
	});

	onCleanup(() => {
		clearTimer();
	});

	return ref;
}
