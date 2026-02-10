#!/bin/bash
# Build a C program for the 6502 simulator
#
# Environment variables:
#   CC65_HOME - Path to cc65 installation (required if not in PATH)
#   CC65_OPTS - Additional compiler options (default: -Os)
#
# Usage: ./build.sh program.c
#
# Output:
#   program.bin - Raw binary file (16KB ROM image)
#   program.rom.dsl - DSL ROM snippet for simulator
#
# Note: Uses crt0-simple.s which has no runtime library dependencies.
# For programs using stdio/string functions, use the full runtime build.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROGRAM=$1

if [ -z "$PROGRAM" ]; then
    echo "Usage: ./build.sh program.c"
    echo ""
    echo "Builds a C program for the 6502 simulator."
    echo ""
    echo "Environment variables:"
    echo "  CC65_HOME  - Path to cc65 installation (optional if cc65 is in PATH)"
    echo "  CC65_OPTS  - Compiler options (default: -Os)"
    echo ""
    echo "Output files:"
    echo "  program.bin      - Raw 16KB binary file"
    echo "  program.rom.dsl  - DSL ROM snippet"
    exit 1
fi

NAME="${PROGRAM%.c}"

# Find cc65 tools - check PATH first, then CC65_HOME
if command -v cc65 &> /dev/null; then
    CC65=cc65
    CA65=ca65
    LD65=ld65
elif [ -n "$CC65_HOME" ]; then
    CC65="$CC65_HOME/bin/cc65"
    CA65="$CC65_HOME/bin/ca65"
    LD65="$CC65_HOME/bin/ld65"
else
    echo "Error: cc65 not found in PATH and CC65_HOME not set"
    echo ""
    echo "Install cc65:"
    echo "  macOS:  brew install cc65"
    echo "  Ubuntu: apt-get install cc65"
    echo "  Or set: export CC65_HOME=/path/to/cc65"
    exit 1
fi

# Default optimization for size
CC65_OPTS="${CC65_OPTS:--Os}"

echo "Building $PROGRAM..."
echo "  Compiler: $CC65"
echo "  Options: $CC65_OPTS"

# Compile C to assembly
echo "  Compiling C -> ASM..."
$CC65 -t none $CC65_OPTS "$PROGRAM" -o "$NAME.s"

# Assemble all files
echo "  Assembling..."
$CA65 "$NAME.s" -o "$NAME.o"
$CA65 "$SCRIPT_DIR/crt0-simple.s" -o "$SCRIPT_DIR/crt0-simple.o"

# Link (simple version - no runtime library)
echo "  Linking..."
$LD65 -C "$SCRIPT_DIR/sim6502.cfg" -o "$NAME.bin" \
    "$SCRIPT_DIR/crt0-simple.o" "$NAME.o"

# Convert to DSL ROM format
echo "  Converting to DSL..."
node "$SCRIPT_DIR/bin2dsl.js" "$NAME.bin" > "$NAME.rom.dsl"

# Clean up intermediate files
rm -f "$NAME.s" "$NAME.o" "$SCRIPT_DIR/crt0-simple.o"

echo ""
echo "Built successfully:"
echo "  $NAME.bin ($(wc -c < "$NAME.bin" | tr -d ' ') bytes)"
echo "  $NAME.rom.dsl"
