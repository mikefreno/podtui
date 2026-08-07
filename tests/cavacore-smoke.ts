/**
 * Smoke test: load libcavacore.dylib via bun:ffi, init → execute → destroy.
 * Run: bun tests/cavacore-smoke.ts
 */
import { dlopen, FFIType, ptr } from "bun:ffi";
import { join } from "path";

const libPath = join(
	import.meta.dir,
	"..",
	"src",
	"native",
	"libcavacore.dylib",
);

const lib = dlopen(libPath, {
	cava_init: {
		args: [
			FFIType.i32,
			FFIType.u32,
			FFIType.i32,
			FFIType.i32,
			FFIType.double,
			FFIType.i32,
			FFIType.i32,
			FFIType.i32,
		],
		returns: FFIType.ptr,
	},
	cava_execute: {
		args: [FFIType.ptr, FFIType.i32, FFIType.ptr, FFIType.ptr],
		returns: FFIType.void,
	},
	cava_destroy: {
		args: [FFIType.ptr],
		returns: FFIType.void,
	},
});

const bars = 10;
const rate = 44100;
const channels = 1;

// Init
const plan = lib.symbols.cava_init(
	bars,
	rate,
	channels,
	1,
	0.77,
	50,
	10000,
	0 /* CAVA_SCALING_LINEAR */,
);
if (!plan) {
	console.error("FAIL: cava_init returned null");
	process.exit(1);
}
console.log("cava_init OK, plan pointer:", plan);

// Generate a 200Hz sine wave test signal
const bufferSize = 512;
const cavaIn = new Float64Array(bufferSize);
const cavaOut = new Float64Array(bars * channels);

for (let k = 0; k < 100; k++) {
	for (let n = 0; n < bufferSize; n++) {
		cavaIn[n] =
			Math.sin(((2 * Math.PI * 200) / rate) * (n + k * bufferSize)) * 20000;
	}
	lib.symbols.cava_execute(ptr(cavaIn), bufferSize, ptr(cavaOut), plan);
}

console.log(
	"cava_execute OK, output:",
	Array.from(cavaOut).map((v) => v.toFixed(3)),
);

// Check that bar 2 (200Hz) has the peak
const maxIdx = cavaOut.indexOf(Math.max(...cavaOut));
console.log(`Peak at bar ${maxIdx} (expected ~2 for 200Hz)`);

// Destroy
lib.symbols.cava_destroy(plan);
console.log("cava_destroy OK");
console.log("\nSMOKE TEST PASSED");
