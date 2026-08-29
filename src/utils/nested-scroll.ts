/**
 * Nested scroll sections favor the innermost one under the cursor.
 *
 * opentui bubbles a wheel event up the renderable tree, so every ancestor
 * `ScrollBoxRenderable` that has room to move scrolls — nested sections (e.g.
 * the episode-description scrollbox inside a page's list pane) scroll in
 * lockstep. This patches the scrollbox's wheel handler so the innermost
 * scrollbox under the cursor wins instead:
 *
 *   • The first scrollbox that can move in the wheel's direction scrolls and
 *     stops propagation, so its ancestors don't also scroll.
 *   • When it is already at its boundary it lets the next outer scrollbox
 *     take over (wheel chaining), matching typical nested-scroll UX.
 */

import { ScrollBoxRenderable } from "@opentui/core";
import type { MouseEvent } from "@opentui/core";

type ScrollDir = "up" | "down" | "left" | "right";

// The scrollbox's own wheel handler (scrolls, then bubbles to its parent).
const original = ScrollBoxRenderable.prototype.onMouseEvent;

let installed = false;

/** True when `sb` has room to move in `dir` from its current position. */
function canScroll(sb: ScrollBoxRenderable, dir: ScrollDir): boolean {
	const maxTop = Math.max(0, sb.scrollHeight - sb.viewport.height);
	const maxLeft = Math.max(0, sb.scrollWidth - sb.viewport.width);
	switch (dir) {
		case "up":
			return sb.scrollTop > 0;
		case "down":
			return sb.scrollTop < maxTop;
		case "left":
			return sb.scrollLeft > 0;
		case "right":
			return sb.scrollLeft < maxLeft;
	}
}

const handleWheel = function (
	this: ScrollBoxRenderable,
	event: MouseEvent,
): void {
	if (event.type !== "scroll" || !event.scroll?.direction) {
		original.call(this, event);
		return;
	}

	const dir = event.scroll.direction;
	const effective: ScrollDir = event.modifiers.shift
		? (dir === "up" ? "left" : dir === "down" ? "right" : dir === "right" ? "down" : "up")
		: dir;

	const moves = canScroll(this, effective);
	original.call(this, event);
	// Only claim the wheel when this box actually moved; otherwise let the
	// next outer scrollbox (also under the cursor) take over.
	if (moves) event.stopPropagation();
};

export function installNestedScrollBehavior(): void {
	if (installed || typeof original !== "function") return;
	installed = true;
	// `onMouseEvent` is a well-known protected method; the cast only bypasses
	// TypeScript's protected-access check and trusts the shipped class shape.
	const scrollboxProto = ScrollBoxRenderable.prototype as unknown as {
		onMouseEvent: typeof handleWheel;
	};
	scrollboxProto.onMouseEvent = handleWheel;
}
