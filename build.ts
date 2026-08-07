import solidPlugin from "@opentui/solid/bun-plugin";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { plugin } from "bun";

// Register the solid transform globally (dedup'd by name). This is what makes
// `--compile` work: compile-mode builds only apply `onLoad` transform plugins
// that are registered via `plugin()`, not the `plugins:` array. The compiled
// binary is then built against an empty bunfig (PODTUI_COMPILE config) so the
// runtime bakes NO preload — the solid transform is already in the binary.
plugin(solidPlugin);

const COMPILE =
	process.argv.includes("--compile") || process.env.PODTUI_COMPILE === "1";

const platform = process.platform;
const arch = process.arch;

// Platform/arch → OpenTUI package name
const platformMap: Record<string, string> = {
	"darwin-arm64": "darwin-arm64",
	"darwin-x64": "darwin-x64",
	"linux-x64": "linux-x64",
	"linux-arm64": "linux-arm64",
	"win32-x64": "win32-x64",
	"win32-arm64": "win32-arm64",
};

const libExt =
	platform === "win32" ? "dll" : platform === "darwin" ? "dylib" : "so";

// Build the JavaScript bundle
await Bun.build({
	entrypoints: ["./src/index.tsx"],
	outdir: "./dist",
	target: "bun",
	minify: true,
	sourcemap: "external",
	plugins: [solidPlugin],
});

// Copy the opentui native library to dist for distribution.
const platformKey = `${platform}-${arch}`;
const platformPkg = platformMap[platformKey];

if (platformPkg) {
	const libName = `libopentui.${libExt}`;
	const srcPath = join("node_modules", `@opentui/core-${platformPkg}`, libName);

	if (existsSync(srcPath)) {
		const destPath = join("dist", libName);
		copyFileSync(srcPath, destPath);
		console.log(`Copied native library: ${libName}`);
	}
}

// Copy cavacore native library to dist
const cavacoreLib = `libcavacore.${libExt}`;
const cavacoreSrc = join("src", "native", cavacoreLib);

if (existsSync(cavacoreSrc)) {
	copyFileSync(cavacoreSrc, join("dist", cavacoreLib));
	console.log(`Copied cavacore library: ${cavacoreLib}`);
} else {
	console.warn(
		`Warning: ${cavacoreSrc} not found — run scripts/build-cavacore.sh first`,
	);
}

// ── Standalone compiled binary (dist/podtui + libs beside it) ──────────────
// `bun run build.ts --compile` (or PODTUI_COMPILE=1). Embeds the Bun runtime
// so end users need nothing installed; the two FFI libs are shipped as
// SIBLING FILES next to the binary (both loaders already resolve them that
// way: cavacore checks dirname(process.execPath); opentui embeds via its
// bun-plugin and handles the embedded-file path itself).
if (COMPILE) {
	const outfile = join("dist", "podtui");
	await Bun.build({
		entrypoints: ["./src/index.tsx"],
		target: "bun",
		minify: true,
		sourcemap: "external",
		plugins: [solidPlugin],
		compile: {
			outfile,
		},
	});
	console.log(`Compiled standalone binary: ${outfile}`);

	// Ensure both native libs sit beside the binary.
	const opentuiSrc = join(
		"node_modules",
		`@opentui/core-${platformPkg}`,
		`libopentui.${libExt}`,
	);
	if (existsSync(opentuiSrc)) {
		copyFileSync(opentuiSrc, join("dist", `libopentui.${libExt}`));
	}
	if (!existsSync(join("dist", cavacoreLib))) {
		console.warn(
			`Warning: ${cavacoreLib} missing beside the binary — run scripts/build-cavacore.sh`,
		);
	}

	// Tarball: podtui + the two native libs (drop the JS bundle dir)
	const tarRoot = join("dist", `podtui-${platform}-${arch}`);
	rmSync(tarRoot, { recursive: true, force: true });
	mkdirSync(tarRoot, { recursive: true });
	copyFileSync(outfile, join(tarRoot, "podtui"));
	for (const lib of [`libopentui.${libExt}`, cavacoreLib]) {
		const s = join("dist", lib);
		if (existsSync(s)) copyFileSync(s, join(tarRoot, lib));
	}
	const tar = Bun.spawnSync([
		"tar",
		"-czf",
		`${tarRoot}.tar.gz`,
		"-C",
		"dist",
		`podtui-${platform}-${arch}`,
	]);
	if (tar.exitCode !== 0) {
		console.error(tar.stderr.toString());
		process.exit(1);
	}
	console.log(`Tarball: ${tarRoot}.tar.gz`);
	rmSync(tarRoot, { recursive: true, force: true });
}

console.log("Build complete");
