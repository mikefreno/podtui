# PodTui — Makefile
#
# Development targets:
#   make install     install dependencies (bun install) + build native lib
#   make dev         run with hot reload
#   make test        run the test suite
#   make build       produce the JS bundle + native libs in dist/
#   make native      build the cavacore FFI library from C source
#   make lint        run typecheck-style checks (lsp), not eslint
#
# Packaging / release targets:
#   make dist        build a standalone compiled binary + tarball for the
#                    CURRENT platform (see dist/ for podtui + libs + tarball)
#   make dist-mac    alias for `dist` targeting macOS (run on macOS)
#   make dist-linux  alias for `dist` targeting Linux (run on Linux)
#   make clean       remove dist/ output
#
# Cross-platform binaries are produced by CI (GitHub Actions) with one runner
# per OS/arch — Bun cannot cross-compile, so dist:mac / dist:linux only produce
# the binary for the OS they run on. Each runner runs `make dist` and uploads
# its podtui-<platform>-<arch>.tar.gz artifact.

SHELL := /bin/bash

.PHONY: install dev build native dist dist-mac dist-linux test clean

## Install dependencies and build the native runtime library.
install:
	bun install
	make native

## Run the dev server with hot reload.
dev:
	bun run dev

## Type-check the whole project. (See AGENTS.md: `bun run lint` points at a
## nonexistent lint.ts; LSP diagnostics are the maintained clean bar.)
lint:
	bun tsc --noEmit

## Build the JS bundle + native libs into dist/ (the `podtui` npm bin target).
build:
	bun run build

## Build the cavacore FFI library from src/native/cavacore.c.
native:
	scripts/build-cavacore.sh

## Standalone binary + native-libs tarball for the current platform.
## Compiles against an empty bunfig so the binary does not bake the
## @opentui/solid/preload entry (which would break the compiled executable).
dist:
	BUN_CONFIG=bunfig.standalone.toml bun run build.ts --compile

## macOS build (run on a macOS runner / host).
dist-mac:
	BUN_CONFIG=bunfig.standalone.toml bun run build.ts --compile

## Linux build (run on a Linux runner / host).
dist-linux:
	BUN_CONFIG=bunfig.standalone.toml bun run build.ts --compile

## Remove build artifacts.
clean:
	rm -rf dist