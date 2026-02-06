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

# Resolve fftw3 paths
if [ "$OS" = "Darwin" ]; then
  if [ "$ARCH" = "arm64" ]; then
    FFTW_PREFIX="${FFTW_PREFIX:-/opt/homebrew}"
  else
    FFTW_PREFIX="${FFTW_PREFIX:-/usr/local}"
  fi
  LIB_EXT="dylib"
  SHARED_FLAG="-dynamiclib"
  INSTALL_NAME="-install_name @rpath/libcavacore.dylib"
else
  FFTW_PREFIX="${FFTW_PREFIX:-/usr}"
  LIB_EXT="so"
  SHARED_FLAG="-shared"
  INSTALL_NAME=""
fi

FFTW_INCLUDE="$FFTW_PREFIX/include"
FFTW_STATIC="$FFTW_PREFIX/lib/libfftw3.a"

if [ ! -f "$FFTW_STATIC" ]; then
  echo "Error: libfftw3.a not found at $FFTW_STATIC"
  echo "Install fftw3: brew install fftw (macOS) or apt install libfftw3-dev (Linux)"
  exit 1
fi

if [ ! -f "$SRC" ]; then
  echo "Error: cavacore.c not found at $SRC"
  echo "Ensure the cava submodule is initialized: git submodule update --init"
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
