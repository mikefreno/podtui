#!/usr/bin/env bash
#
# Build cavacore as a shared library with fftw3 statically linked.
#
# Prerequisites:
#   macOS:  brew install fftw
#   Linux:  apt install libfftw3-dev  (or equivalent)
#
# Output: src/native/libcavacore.{dylib,so}

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/cava/cavacore.c"
OUT_DIR="$ROOT/src/native"

mkdir -p "$OUT_DIR"

OS="$(uname -s)"
ARCH="$(uname -m)"

# Resolve fftw3 paths. The static archive lives in different places per
# platform: Homebrew (/opt/homebrew on arm64, /usr/local on Intel) and, on
# Debian/Ubuntu, the multiarch dir /usr/lib/<triplet> (e.g.
# x86_64-linux-gnu, aarch64-linux-gnu).
if [ "$OS" = "Darwin" ]; then
	LIB_EXT="dylib"
	SHARED_FLAG="-dynamiclib"
	INSTALL_NAME="-install_name @rpath/libcavacore.dylib"
	if [ "$ARCH" = "arm64" ]; then
		FFTW_HINTS="/opt/homebrew /usr/local"
	else
		FFTW_HINTS="/usr/local /opt/homebrew"
	fi
else
	LIB_EXT="so"
	SHARED_FLAG="-shared"
	INSTALL_NAME=""
	FFTW_HINTS="/usr /usr/local"
fi

FFTW_PREFIX="${FFTW_PREFIX:-}"
FFTW_STATIC=""
if [ -n "$FFTW_PREFIX" ]; then
	FFTW_STATIC="$FFTW_PREFIX/lib/libfftw3.a"
else
	for hint in $FFTW_HINTS; do
		for cand in "$hint/lib/libfftw3.a" "$hint/lib/${ARCH}-linux-gnu/libfftw3.a"; do
			if [ -f "$cand" ]; then
				FFTW_STATIC="$cand"
				FFTW_PREFIX="$hint"
				break 2
			fi
		done
	done
fi

if [ -z "$FFTW_STATIC" ] || [ ! -f "$FFTW_STATIC" ]; then
	echo "Error: libfftw3.a not found (searched: ${FFTW_HINTS})"
	echo "Install fftw3: brew install fftw (macOS) or apt install libfftw3-dev (Linux)"
	echo "or point FFTW_PREFIX at a prefix containing lib/libfftw3.a."
	exit 1
fi

FFTW_INCLUDE="$FFTW_PREFIX/include"
if [ ! -d "$FFTW_INCLUDE" ]; then
	FFTW_INCLUDE="$FFTW_PREFIX/include/$(basename "$(dirname "$FFTW_STATIC")")"
fi

if [ ! -f "$SRC" ]; then
	echo "Error: cavacore.c not found at $SRC"
	echo "The cava source is vendored under cava/ (from github.com/karlstav/cava, MIT)."
	exit 1
fi

OUT="$OUT_DIR/libcavacore.$LIB_EXT"

echo "Building libcavacore.$LIB_EXT ($OS $ARCH)"
echo "  Source:  $SRC"
echo "  FFTW3:   $FFTW_STATIC"
echo "  Output:  $OUT"

cc -O2 \
	$SHARED_FLAG \
	$INSTALL_NAME \
	-fPIC \
	-I"$FFTW_INCLUDE" \
	-I"$ROOT/cava" \
	-o "$OUT" \
	"$SRC" \
	"$FFTW_STATIC" \
	-lm

echo "Built: $OUT"

# Verify exported symbols
if [ "$OS" = "Darwin" ]; then
	echo ""
	echo "Exported symbols:"
	nm -gU "$OUT" | grep "cava_"
fi
