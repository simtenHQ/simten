# DSL Example Files

This directory contains example DSL circuits for the Turing Incomplete simulator.

## Systolic Arrays (Matrix Multiplication Accelerators)

These demonstrate progressive architectural improvements for 2×2 systolic arrays. See `../SYSTOLIC_IMPROVEMENTS.md` for detailed explanation.

### Production Implementations

1. **`Systolic2x2_CounterBased.dsl`** - Baseline
   - Simple global counter-based control
   - Explicit k-phase tracking
   - Reference implementation: A×B → C (2×2 matrices)

2. **`Systolic2x2_Streaming.dsl`** - Phase 1: Implicit K-Timing
   - Removes explicit k-phase register
   - Uses cycle-based detection (cycle >= 5)
   - 5 fewer nodes than baseline
   - Same timing (9 cycles)

3. **`Systolic2x2_VerticalWeights.dsl`** - Phase 2: Vertical Weight Flow ⭐
   - **Best for scaling!**
   - Self-timed weight distribution with valid bits
   - Scales to arbitrary N×N without modification
   - +2 cycles (11 total) for weight propagation
   - Production-like architecture (matches real TPUs)

4. **`Systolic2x2_Wavefront.dsl`** - Phase 3: Wavefront Enables
   - Distributed control (no global counter)
   - Phase FSM with enable chains
   - Industry-standard wavefront scheduling
   - ~11 cycles

5. **`Systolic3x3_CounterBased.dsl`** - 3×3 Extension
   - Demonstrates scaling to larger arrays
   - 3×3 matrix multiplication
   - Uses baseline counter-based approach

### Test Pattern

All systolic arrays compute:
```
A = [1, 2]    B = [5, 6]    C = [19, 22]
    [3, 4]        [7, 8]        [43, 50]
```

Load, press START, clock 9-11 times, verify done LED and HexDisplay outputs.

---

## Games

### Snake

- **`snake.dsl`** - Basic snake game
- **`SnakeAdvanced.dsl`** - Advanced snake with more features

### Pong

- **`PongSimple.dsl`** - Simple Pong game

---

## Physics Simulations

### Bouncing Ball

- **`bouncing-ball-1d-fixed.dsl`** - 1D bouncing ball (fixed-point math)
- **`bouncing-ball-2d.dsl`** - 2D bouncing ball with gravity
- **`bouncing-ball-damped.dsl`** - Damped bouncing ball (single buffer, has flicker)
- **`bouncing-ball-damped-double-buffered.dsl`** - Damped bouncing ball with double buffering ⭐
  - **No flicker!** Uses VSYNC-style buffer swapping
  - Two DualPortRAMs (front + back buffer)
  - Screen always reads from complete frame
  - Standard technique used in NES, SNES, modern GPUs
  - +1 frame latency (imperceptible at normal speeds)

---

## Display Examples

- **`scrolling-hello.dsl`** - Scrolling "Hello" text on raster display

---

## Usage

Load any `.dsl` file in the web interface to see the circuit and run simulations.

For systolic arrays:
1. Load DSL file
2. Toggle START switch
3. Clock the specified number of times
4. Verify outputs on HexDisplay components

For games:
1. Load DSL file
2. Use switches/buttons for controls
3. Observe output on Screen component

---

## Architecture Notes

The systolic array implementations demonstrate key concepts:
- **Self-timed pipelines** with valid bits
- **Distributed control** vs global counters
- **Scalability patterns** for large accelerators
- **Production techniques** from real TPU designs

See `../SYSTOLIC_IMPROVEMENTS.md` for detailed architectural discussion.
