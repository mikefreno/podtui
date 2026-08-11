import { createSignal, onMount } from "solid-js";
import { createSimpleContext } from "./helper";
import {
	copyKeybindsIfNeeded,
	loadKeybindsFromFile,
	saveKeybindsToFile,
} from "../utils/keybinds-persistence";
import { createStore } from "solid-js/store";

// ── Keybind model ───────────────────────────────────────────────────────────
// Yazi-style: every binding is one or more "strokes". A stroke is a single
// key press (key + optional ctrl/shift/meta). Multi-stroke bindings form a
// sequence (e.g. ["g","g"] = gg, ["space","n"] = <leader>n). The matcher
// buffers keystrokes, prefers the longest matching sequence, and exposes the
// pending buffer reactively so the status bar can show it (very yazi).

/** A single key press. `key` is the lowercase logical key name
 *  ("j", "return", "space", "up", "f1", ...). */
export interface Stroke {
	key: string;
	ctrl?: boolean;
	shift?: boolean;
	meta?: boolean;
}

/** Raw config spec for one action: a list of alternative sequences. Each
 *  alternative is itself a list of stroke-notation strings. So
 *  "j"                    -> [[ {key:"j"} ]]
 *  ["j","down"]           -> [[ {key:"j"} ], [ {key:"down"} ]]
 *  [["g","g"],"G"]        -> [[ {key:"g"},{key:"g"} ], [ {key:"g",shift:true} ]] */
export type KeybindSpec = string | (string | string[])[];

/** Canonical action names. Must match keys in keybinds.jsonc. */
export type KeybindActionName =
	| "move-down"
	| "move-up"
	| "page-down"
	| "page-up"
	| "full-down"
	| "full-up"
	| "jump-down"
	| "jump-up"
	| "goto-top"
	| "goto-bottom"
	| "swipe-prev"
	| "swipe-next"
	| "open"
	| "open-interactive"
	| "toggle-select"
	| "visual-mode"
	| "toggle-all"
	| "invert-all"
	| "escape"
	| "tab-prev"
	| "tab-next"
	| "tab-goto-1"
	| "tab-goto-2"
	| "tab-goto-3"
	| "tab-goto-4"
	| "tab-goto-5"
	| "tab-goto-6"
	| "command"
	| "quit"
	| "help"
	| "search"
	| "search-scope-toggle"
	| "filter"
	| "sort"
	| "toggle-hidden"
	| "refresh"
	| "subscribe"
	| "unsubscribe"
	| "download"
	| "delete-download"
	| "whitelist-toggle"
	| "audio-toggle"
	| "audio-next"
	| "audio-prev"
	| "audio-seek-forward"
	| "audio-seek-backward";

/** Resolved config: action -> list of alternative stroke-sequences. */
export type KeybindsResolved = Partial<Record<KeybindActionName, KeybindSpec>>;

const SEQ_TIMEOUT_MS = 600;

// ── Stroke parsing ───────────────────────────────────────────────────────────
// Notation: "ctrl-d", "shift-j", "meta-x", "C-d", "M-x", "S-j".
//           uppercase letter "G" => {key:"g", shift:true}
//           special: return/enter/escape/tab/space/backspace/up/down/left/right

export function parseStroke(notation: string): Stroke {
	const raw = notation.trim();
	let ctrl = false,
		shift = false,
		meta = false;
	let key = raw;
	const parts = raw.split(/[-+]/);
	if (parts.length > 1) {
		key = parts[parts.length - 1];
		for (const mod of parts.slice(0, -1)) {
			const m = mod.toLowerCase();
			if (m === "ctrl" || m === "c") ctrl = true;
			else if (m === "shift" || m === "s") shift = true;
			else if (m === "meta" || m === "alt" || m === "m") meta = true;
		}
	}
	// Uppercase single letter w/o modifier => shift+letter (vim convention)
	if (
		parts.length === 1 &&
		key.length === 1 &&
		key >= "A" &&
		key <= "Z" &&
		!ctrl &&
		!shift &&
		!meta
	) {
		shift = true;
		key = key.toLowerCase();
	}
	return { key: key.toLowerCase(), ctrl, shift, meta };
}

/** Turn one raw spec into a list of alternative stroke-sequences. */
export function parseBindingSpec(spec: KeybindSpec | undefined): Stroke[][] {
	if (spec == null) return [];
	const alts: Stroke[][] = [];
	const push = (item: string | string[]) => {
		const seq = Array.isArray(item) ? item : [item];
		alts.push(seq.map(parseStroke));
	};
	if (Array.isArray(spec)) {
		for (const item of spec) push(item);
	} else {
		push(spec);
	}
	return alts;
}

/** Build a Stroke from a keyboard event (opentui shape: name + ctrl/shift/meta). */
function strokeFromEvent(evt: {
	name: string;
	ctrl?: boolean;
	meta?: boolean;
	shift?: boolean;
}): Stroke {
	// Uppercase letter events from opentui arrive as name="q" + shift; normalize.
	return {
		key: evt.name.toLowerCase(),
		ctrl: !!evt.ctrl,
		shift: !!evt.shift,
		meta: !!evt.meta,
	};
}

function strokeEq(a: Stroke, b: Stroke): boolean {
	return (
		a.key === b.key &&
		!!a.ctrl === !!b.ctrl &&
		!!a.shift === !!b.shift &&
		!!a.meta === !!b.meta
	);
}

/** A human label for a stroke, for the status bar / help. */
function strokeLabel(s: Stroke): string {
	let out = "";
	if (s.ctrl) out += "C-";
	if (s.meta) out += "M-";
	if (s.shift) out += "S-";
	out += s.key;
	return out;
}

function sequenceLabel(seq: Stroke[]): string {
	return seq.map(strokeLabel).join(" ");
}

export const { use: useKeybinds, provider: KeybindProvider } =
	createSimpleContext({
		name: "Keybinds",
		init: () => {
			const [store, setStore] = createStore<KeybindsResolved>({});
			// Resolved sequences per action, recomputed when store changes.
			const [resolved, setResolved] = createSignal<Record<string, Stroke[][]>>(
				{},
			);
			const [ready, setReady] = createSignal(false);
			const [pending, setPending] = createSignal<Stroke[]>([]);

			let pendingTimer: ReturnType<typeof setTimeout> | undefined;

			function recompute() {
				const out: Record<string, Stroke[][]> = {};
				for (const name of Object.keys(store) as string[]) {
					out[name] = parseBindingSpec((store as any)[name]);
				}
				setResolved(out);
			}

			async function load() {
				await copyKeybindsIfNeeded();
				const keybinds = await loadKeybindsFromFile();
				setStore(keybinds);
				recompute();
				setReady(true);
			}

			async function save() {
				saveKeybindsToFile(store as KeybindsResolved);
			}

			function print(input: KeybindActionName): string {
				const alts = resolved()[input] ?? [];
				return alts.map(sequenceLabel).join(" / ") || "—";
			}

			function clearPending() {
				if (pendingTimer) {
					clearTimeout(pendingTimer);
					pendingTimer = undefined;
				}
				if (pending().length > 0) setPending([]);
			}

			function armTimer() {
				if (pendingTimer) clearTimeout(pendingTimer);
				pendingTimer = setTimeout(() => clearPending(), SEQ_TIMEOUT_MS);
			}

			/** Look up every action whose sequence-list the candidate is a prefix of
			 *  (i.e. a longer match is still possible) and every action that the
			 *  candidate exactly equals. */
			function classify(candidate: Stroke[]) {
				const exact: KeybindActionName[] = [];
				const prefix: KeybindActionName[] = [];
				const map = resolved();
				for (const name of Object.keys(map) as KeybindActionName[]) {
					for (const seq of map[name] ?? []) {
						if (seq.length < candidate.length) continue;
						let isPrefix = true;
						for (let i = 0; i < candidate.length; i++) {
							if (!strokeEq(seq[i], candidate[i])) {
								isPrefix = false;
								break;
							}
						}
						if (!isPrefix) continue;
						if (seq.length === candidate.length) exact.push(name);
						else prefix.push(name);
					}
				}
				return { exact, prefix };
			}

			/** Legacy single-key matcher (used by command-palette registrations and
			 *  older call sites). Returns true iff `name`'s sequence list contains a
			 *  single-stroke alternative equal to the event. */
			function match(
				name: KeybindActionName,
				evt: { name: string; ctrl?: boolean; meta?: boolean; shift?: boolean },
			): boolean {
				const alts = resolved()[name] ?? [];
				const s = strokeFromEvent(evt);
				// skip in command/input mode unless explicitly handled by caller
				for (const seq of alts) {
					if (seq.length === 1 && strokeEq(seq[0], s)) return true;
				}
				return false;
			}

			/** New sequence-aware matcher. Returns the resolved action or null.
			 *  Callers should invoke this once per keypress in a single router. */
			function tryMatch(evt: {
				name: string;
				ctrl?: boolean;
				meta?: boolean;
				shift?: boolean;
			}): KeybindActionName | null {
				const stroke = strokeFromEvent(evt);
				const candidate = [...pending(), stroke];

				const { exact, prefix } = classify(candidate);

				// Still mid-sequence: wait for more keys (unless this stroke also
				// exactly matches something AND nothing depends on a longer prefix).
				if (prefix.length > 0) {
					setPending(candidate);
					armTimer();
					// If there's also an exact match, we *could* fire now — but yazi
					// prefers to wait for the longer sequence within the timeout, then
					// falls through. We honor that: only fire exact if no prefix.
					if (exact.length > 0) {
						// ambiguous prefix+exact: keep waiting (e.g. `g` could be gg)
					}
					return null;
				}

				// No longer-match possible: decide on exact.
				clearPending();
				if (exact.length === 0) {
					// The new stroke might itself begin a fresh sequence.
					const fresh = classify([stroke]);
					if (fresh.prefix.length > 0) {
						setPending([stroke]);
						armTimer();
						return null;
					}
					if (fresh.exact.length > 0) {
						// prefer longest-sequence match among fresh.exact
						return pickLongest(fresh.exact);
					}
					return null;
				}
				return pickLongest(exact);
			}

			function pickLongest(names: KeybindActionName[]): KeybindActionName {
				const map = resolved();
				let best = names[0];
				let bestLen = 0;
				for (const n of names) {
					for (const seq of map[n] ?? []) {
						if (seq.length > bestLen) {
							bestLen = seq.length;
							best = n;
						}
					}
				}
				return best;
			}

			onMount(() => {
				load().catch(() => {});
			});

			return {
				get ready() {
					return ready();
				},
				get keybinds() {
					return store;
				},
				get resolved() {
					return resolved();
				},
				pending,
				match,
				tryMatch,
				print,
				save,
				load,
				clearPending,
			};
		},
	});
