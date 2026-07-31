import { parseStroke, parseBindingSpec } from "../src/context/KeybindContext";

const cfg = {
	"move-down": parseBindingSpec(["j", "down"]),
	"move-up": parseBindingSpec(["k", "up"]),
	"goto-top": parseBindingSpec([["g", "g"]]),
	"goto-bottom": parseBindingSpec(["G"]),
	"toggle-select": parseBindingSpec(["space"]),
	"swipe-prev": parseBindingSpec(["h", "left"]),
	"audio-toggle": parseBindingSpec(["P"]),
	"audio-seek-forward": parseBindingSpec(["shift-."]),
	"audio-seek-backward": parseBindingSpec(["shift-,"]),
	sort: parseBindingSpec([","]),
	quit: parseBindingSpec(["q"]),
	command: parseBindingSpec([":"]),
	"tab-next": parseBindingSpec(["]"]),
} as Record<string, ReturnType<typeof parseBindingSpec>>;

function eq(a: any, b: any) {
	return (
		a.key === b.key &&
		!!a.ctrl === !!b.ctrl &&
		!!a.shift === !!b.shift &&
		!!a.meta === !!b.meta
	);
}
function classify(candidate: any[]) {
	const exact: string[] = [];
	const prefix: string[] = [];
	for (const name of Object.keys(cfg)) {
		for (const seq of cfg[name]) {
			if (seq.length < candidate.length) continue;
			let p = true;
			for (let i = 0; i < candidate.length; i++)
				if (!eq(seq[i], candidate[i])) {
					p = false;
					break;
				}
			if (!p) continue;
			if (seq.length === candidate.length) exact.push(name);
			else prefix.push(name);
		}
	}
	return { exact, prefix };
}
function longest(names: string[]) {
	let best = names[0],
		bl = 0;
	for (const n of names)
		for (const s of cfg[n])
			if (s.length > bl) {
				bl = s.length;
				best = n;
			}
	return best;
}
function sim(strokes: any[]) {
	let pending: any[] = [];
	let fired: string | null = null;
	for (const st of strokes) {
		const cand = [...pending, st];
		const { exact, prefix } = classify(cand);
		if (prefix.length > 0) {
			pending = cand;
			continue;
		}
		if (exact.length === 0) {
			const fresh = classify([st]);
			if (fresh.prefix.length > 0) {
				pending = [st];
				continue;
			}
			if (fresh.exact.length > 0) fired = longest(fresh.exact);
			else fired = null;
		} else fired = longest(exact);
		pending = [];
	}
	return fired;
}
const E = (k: string, o: any = {}) => ({ key: k, ...o });

let pass = 0,
	fail = 0;
function check(label: string, got: string | null, want: string | null) {
	const ok = got === want;
	if (ok) pass++;
	else fail++;
	console.log(
		`${ok ? "PASS" : "FAIL"}  ${label}  => ${got}${ok ? "" : ` (want ${want})`}`,
	);
}

check("j -> move-down", sim([E("j")]), "move-down");
check("down -> move-down", sim([E("down")]), "move-down");
check("gg -> goto-top", sim([E("g"), E("g")]), "goto-top");
check("G -> goto-bottom", sim([E("g", { shift: true })]), "goto-bottom");
check("space -> toggle-select", sim([E("space")]), "toggle-select");
check("q -> quit", sim([E("q")]), "quit");
check(": -> command", sim([E(":")]), "command");
check("] -> tab-next", sim([E("]")]), "tab-next");
check(
	"shift+p -> audio-toggle",
	sim([E("p", { shift: true })]),
	"audio-toggle",
);
check("plain p -> null", sim([E("p")]), null);
check(
	"shift+, -> audio-seek-backward",
	sim([E(",", { shift: true })]),
	"audio-seek-backward",
);
check(", -> sort", sim([E(",")]), "sort");
check(
	"shift+. -> audio-seek-forward",
	sim([E(".", { shift: true })]),
	"audio-seek-forward",
);
check(
	"g then j -> move-down (timeout-ish fallthrough)",
	sim([E("g"), E("j")]),
	"move-down",
);

console.log(
	parseStroke("ctrl-d"),
	parseStroke("G"),
	parseStroke(">"),
	parseStroke("shift-return"),
);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
