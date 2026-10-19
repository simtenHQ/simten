#!/bin/bash
set -euo pipefail

# Build the in-browser cc65 toolchain for the "From NAND to a 6502" blog post,
# and everything that has to match it, from one pinned cc65 commit:
#
#   - cc65, ca65, ld65 compiled to WebAssembly with Emscripten
#   - none.lib, cc65's runtime and C library for the bare "none" target
#   - crt0-simple.o, assembled from crt0-simple.s
#   - include.json, the standard C headers
#   - the demo ROMs, compiled from blog-assets/sources/*.c
#
# The library and the compiler must come from the same commit: cc65's code
# generator calls runtime helpers by name, and new helpers appear between
# releases (there hasn't been one since V2.19 in 2020).
#
# Prerequisites: emcc (Emscripten) and a C compiler on PATH.
#
#   scripts/build-cc65-wasm.sh                  # clone/fetch into /tmp/cc65
#   CC65_SRC=~/src/cc65 scripts/build-cc65-wasm.sh

CC65_REF="${CC65_REF:-a6530f469}"
CC65_SRC="${CC65_SRC:-/tmp/cc65}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSETS="$PROJECT_ROOT/apps/web/public/blog-assets"
OUT_DIR="$ASSETS/wasm"

if ! command -v emcc &>/dev/null; then
  echo "ERROR: emcc not found. Install Emscripten first." >&2
  exit 1
fi

if [ ! -d "$CC65_SRC/.git" ]; then
  git clone https://github.com/cc65/cc65 "$CC65_SRC"
fi
git -C "$CC65_SRC" fetch --quiet origin
git -C "$CC65_SRC" checkout --quiet "$CC65_REF"
echo "cc65 at $(git -C "$CC65_SRC" describe --tags)"

mkdir -p "$OUT_DIR"

build_tool() {
  local TOOL=$1
  echo "=== Building $TOOL (wasm) ==="

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

# Native tools from the same commit build the library, the startup code and
# the ROMs.
echo "=== Building native tools and none.lib ==="
make -C "$CC65_SRC" -j8 bin >/dev/null
make -C "$CC65_SRC" -j8 lib TARGETS=none >/dev/null
BIN="$CC65_SRC/bin"
cp "$CC65_SRC/lib/none.lib" "$OUT_DIR/none.lib"
cp "$CC65_SRC/asminc/longbranch.mac" "$OUT_DIR/longbranch.mac"

# The portable C headers, bundled into one file the browser compiler writes
# into its virtual filesystem. The machine-specific ones (c64.h, apple2.h...)
# don't apply to this computer.
HEADERS="assert.h ctype.h errno.h inttypes.h iso646.h limits.h setjmp.h stdarg.h stdbool.h
  stddef.h stdint.h stdio.h stdlib.h string.h time.h"
node -e '
  const fs = require("fs");
  const [dir, out, ...names] = process.argv.slice(1);
  const files = Object.fromEntries(names.map((n) => [n, fs.readFileSync(`${dir}/${n}`, "latin1")]));
  fs.writeFileSync(out, JSON.stringify(files));
' "$CC65_SRC/include" "$OUT_DIR/include.json" $HEADERS

echo "=== Assembling crt0-simple.o ==="
"$BIN/ca65" -t none -I "$CC65_SRC/asminc" "$OUT_DIR/crt0-simple.s" -o "$OUT_DIR/crt0-simple.o"

echo "=== Building demo ROMs ==="
TMP="$(mktemp -d)"
for SRC in "$ASSETS"/sources/*.c; do
  NAME="$(basename "$SRC" .c)"
  "$BIN/cc65" -t none -O -I "$CC65_SRC/include" "$SRC" -o "$TMP/$NAME.s"
  "$BIN/ca65" -t none -I "$CC65_SRC/asminc" "$TMP/$NAME.s" -o "$TMP/$NAME.o"
  "$BIN/ld65" -C "$OUT_DIR/sim6502.cfg" -o "$ASSETS/roms/$NAME.bin" \
    "$OUT_DIR/crt0-simple.o" "$TMP/$NAME.o" "$OUT_DIR/none.lib"
  echo "  -> roms/$NAME.bin"
done
rm -rf "$TMP"

echo ""
echo "=== Build complete ==="
ls -lh "$OUT_DIR"/
