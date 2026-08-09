/**
 * useInputFocusNav — returns a `ref` callback for an `<input>` (or any
 * focusable renderable) that holds the navigation store's `inputFocused`
 * flag true while the renderable has focus.
 *
 * Why: the Shell keyboard router (see `components/Shell.tsx`) yields keys to
 * whatever is focused only when `nav.inputFocused()` is true; otherwise it
 * dispatches navigation keybinds (j/k/h/…). Forms rendered inside the
 * depth-stack (e.g. the Settings "Add Source" RSS form) don't drive that
 * flag, so typing into them *also* fired the navigation keybinds. Wiring the
 * flag to each input's real focus/blur state fixes that.
 *
 * A module-level counter guards the blur→focus ordering gap that occurs when
 * tabbing between two inputs in the same form (the old input blurs before the
 * new one focuses) so the flag never flickers off mid-handoff.
 */

import { onCleanup } from "solid-js";
import { RenderableEvents } from "@opentui/core";
import { useNavigation } from "@/context/NavigationContext";

// Inputs (managed by this hook) currently holding focus.
let focusedCount = 0;

export function useInputFocusNav() {
	const nav = useNavigation();
	let current: any | undefined;

	const onFocused = () => {
		focusedCount++;
		nav.setInputFocused(true);
	};
	const onBlurred = () => {
		focusedCount = Math.max(0, focusedCount - 1);
		if (focusedCount === 0) nav.setInputFocused(false);
	};

	const detach = (el: any) => {
		el.off(RenderableEvents.FOCUSED, onFocused);
		el.off(RenderableEvents.BLURRED, onBlurred);
		// Treat a focused element being torn down as a blur so the counter
		// doesn't leak and leave inputFocused stuck on.
		if (el.focused) onBlurred();
	};

	const ref = (el: any) => {
		if (current && current !== el) detach(current);
		current = el;
		if (el) {
			el.on(RenderableEvents.FOCUSED, onFocused);
			el.on(RenderableEvents.BLURRED, onBlurred);
			// If the renderable is already focused when attached, count it.
			if (el.focused) onFocused();
		}
	};

	onCleanup(() => {
		if (current) {
			detach(current);
			current = undefined;
		}
	});

	return ref;
}
