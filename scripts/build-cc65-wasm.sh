#!/bin/bash
set -euo pipefail

# Build cc65 toolchain (cc65, ca65, ld65) to WebAssembly using Emscripten.
# Outputs: public/blog-assets/wasm/{cc65,ca65,ld65}.{js,wasm}
#
# Prerequisites:
#   - Emscripten (emcc) on PATH
#   - cc65 source at /tmp/cc65 (git clone https://github.com/cc65/cc65 /tmp/cc65)

CC65_SRC="${CC65_SRC:-/tmp/cc65}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$PROJECT_ROOT/public/blog-assets/wasm"

if ! command -v emcc &>/dev/null; then
  echo "ERROR: emcc not found. Install Emscripten first." >&2
  exit 1
fi

if [ ! -d "$CC65_SRC/src/cc65" ]; then
  echo "ERROR: cc65 source not found at $CC65_SRC" >&2
  echo "  git clone https://github.com/cc65/cc65 /tmp/cc65" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

build_tool() {
  local TOOL=$1
  echo "=== Building $TOOL ==="

  # Gather C source files
  local TOOL_SRCS=("$CC65_SRC"/src/"$TOOL"/*.c)
  local COMMON_SRCS=("$CC65_SRC"/src/common/*.c)

  emcc "${TOOL_SRCS[@]}" "${COMMON_SRCS[@]}" \
    -O2 \
    -I "$CC65_SRC/src/$TOOL" \
    -I "$CC65_SRC/src/common" \
    -o "$OUT_DIR/$TOOL.js" \
    -sMODULARIZE=1 \
    -sEXPORT_NAME="create_${TOOL}" \
    -sEXIT_RUNTIME=0 \
    -sINVOKE_RUN=0 \
    -sALLOW_MEMORY_GROWTH=1 \
    -sFILESYSTEM=1 \
    -sFORCE_FILESYSTEM=1 \
    -sEXPORTED_RUNTIME_METHODS='["callMain","FS"]' \
    -sENVIRONMENT='web,worker' \
    -lm

  echo "  -> $OUT_DIR/$TOOL.js ($(wc -c < "$OUT_DIR/$TOOL.js") bytes)"
  echo "  -> $OUT_DIR/$TOOL.wasm ($(wc -c < "$OUT_DIR/$TOOL.wasm") bytes)"
}

build_tool cc65
build_tool ca65
build_tool ld65

# Copy support files
echo "=== Copying support files ==="
cp "$PROJECT_ROOT/examples/cpu6502/cc65/crt0-simple.o" "$OUT_DIR/crt0-simple.o"
cp "$PROJECT_ROOT/examples/cpu6502/cc65/sim6502.cfg" "$OUT_DIR/sim6502.cfg"
cp "$CC65_SRC/asminc/longbranch.mac" "$OUT_DIR/longbranch.mac"
echo "  -> crt0-simple.o ($(wc -c < "$OUT_DIR/crt0-simple.o") bytes)"
echo "  -> sim6502.cfg ($(wc -c < "$OUT_DIR/sim6502.cfg") bytes)"
echo "  -> longbranch.mac ($(wc -c < "$OUT_DIR/longbranch.mac") bytes)"

echo ""
echo "=== Build complete ==="
ls -lh "$OUT_DIR"/
