import solidPlugin from "@opentui/solid/bun-plugin";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { plugin } from "bun";

// Register the solid transform globally (dedup'd by name). This is what makes
// `--compile` work: compile-mode builds only apply `onLoad` transform plugins
// that are registered via `plugin()`, not the `plugins:` array. The transform
// is fully embedded in the compiled binary.
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
			// Don't let the embedded runtime autoload the launching CWD's
			// bunfig.toml. A top-level `preload` there (common in Bun project
			// dirs) resolves against the CWD, not the binary, so startup dies
			// with "preload not found". With autoload disabled, the binary is
			// config-independent and boots from any directory.
			autoloadBunfig: false,
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

	// App icon: bundled into every platform tarball; Linux also gets the
	// desktop entry so the AUR package can install both system-wide
	// (icon to hicolor, entry to applications/).
	const iconSrc = join("assets", "App Icon", "App Icon.png");
	if (existsSync(iconSrc)) {
		copyFileSync(iconSrc, join(tarRoot, "podtui.png"));
	}
	if (platform === "linux") {
		const desktopSrc = join("packaging", "podtui.desktop");
		if (existsSync(desktopSrc)) {
			copyFileSync(desktopSrc, join(tarRoot, "podtui.desktop"));
		}
	}

	// macOS app bundle: PodTui.app. We run our audio backend (mpv) from
	// INSIDE the bundle (Contents/MacOS/mpv) so macOS attributes its Now
	// Playing session to PodTui — the source-app icon + name in Control
	// Center / lock screen — instead of a blank placeholder for an
	// unbundled binary. AudioPlayer's resolver prefers this sibling.
	if (platform === "darwin") {
		const appRoot = join(tarRoot, "PodTui.app");
		const macosDir = join(appRoot, "Contents", "MacOS");
		const resDir = join(appRoot, "Contents", "Resources");
		mkdirSync(macosDir, { recursive: true });
		mkdirSync(resDir, { recursive: true });

		copyFileSync(outfile, join(macosDir, "podtui"));
		for (const lib of [`libopentui.${libExt}`, cavacoreLib]) {
			const s = join("dist", lib);
			if (existsSync(s)) copyFileSync(s, join(macosDir, lib));
		}

		const mpvResolve = Bun.spawnSync(["which", "mpv"]);
		const mpvPath =
			mpvResolve.exitCode === 0 ? mpvResolve.stdout.toString().trim() : "";
		if (mpvPath) {
			copyFileSync(mpvPath, join(macosDir, "mpv"));
		} else {
			// A darwin release tarball without a bundled mpv silently ships
			// without Now Playing attribution (blank icon). Fail loudly so CI
			// can't produce it — the runner must have mpv installed.
			console.error(
				"Error: mpv not found in PATH — PodTui.app requires a bundled mpv for macOS Now Playing attribution (brew install mpv on the build machine)",
			);
			process.exit(1);
		}

		const icnsSrc = join("assets", "App Icon", "AppIcon.icns");
		if (existsSync(icnsSrc)) {
			copyFileSync(icnsSrc, join(resDir, "AppIcon.icns"));
		} else {
			console.warn(
				"Warning: assets/App Icon/AppIcon.icns missing — app bundle has no icon",
			);
		}

		// Keep CFBundleShortVersionString in sync with src/index.tsx VERSION.
		Bun.write(
			join(appRoot, "Contents", "Info.plist"),
			`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>PodTui</string>
	<key>CFBundleDisplayName</key>
	<string>PodTui</string>
	<key>CFBundleIdentifier</key>
	<string>com.mikefreno.podtui</string>
	<key>CFBundleExecutable</key>
	<string>podtui</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleIconFile</key>
	<string>AppIcon</string>
	<key>CFBundleShortVersionString</key>
	<string>0.3.1</string>
	<key>CFBundleVersion</key>
	<string>0.3.1</string>
	<key>LSMinimumSystemVersion</key>
	<string>12.0</string>
</dict>
</plist>
`,
		);

		// Ad-hoc sign so the bundle launches cleanly on fresh machines.
		// Identity overridable via PODTUI_CODESIGN_IDENTITY (e.g. a Developer
		// ID cert for release builds); default ad-hoc.
		const signIdentity = process.env.PODTUI_CODESIGN_IDENTITY || "-";
		const sign = Bun.spawnSync([
			"codesign",
			"--force",
			"--deep",
			"-s",
			signIdentity,
			appRoot,
		]);
		if (sign.exitCode !== 0) {
			console.warn(
				`Warning: codesign failed (${sign.stderr.toString().trim()}) — app bundle unsigned`,
			);
		}

		// Sign the nested mpv LAST with our bundle identifier. mediaremoted
		// resolves the Now Playing client from the registering process's
		// code-signing identifier — without an explicit --identifier codesign
		// stamps "mpv" (its basename) and the audio center shows a blank
		// placeholder. Must run after the bundle sign above (a later bundle
		// re-seal would re-derive the basename identifier).
		const signMpv = Bun.spawnSync([
			"codesign",
			"--force",
			"-s",
			signIdentity,
			"--identifier",
			"com.mikefreno.podtui",
			join(macosDir, "mpv"),
		]);
		if (signMpv.exitCode !== 0) {
			console.warn(
				`Warning: nested mpv signing failed (${signMpv.stderr
					.toString()
					.trim()}) — Now Playing attribution won't work`,
			);
		}
		console.log(`App bundle: ${appRoot}`);
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
