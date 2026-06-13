# Snake on the ULX3S

The 8×8 Snake game running as pure logic on a Lattice ECP5 (ULX3S), with HDMI
output. The game circuit itself lives in `@simten/core/examples` (the same
`Snake` circuit as the blog demo and the `/circuit?example=snake` editor
example); this project wraps it with the board-level plumbing.

## What's here

- `snake_top.v` — hand-written top level: a clock PLL, VGA-style timing, button
  inputs, and a TMDS encoder for HDMI/DVI output. Instantiates the generated
  `Snake` core. None of this is snake-specific; it's reusable display plumbing.
- `ulx3s_snake.lpf` — pin constraints (25&nbsp;MHz clock, directional buttons,
  GPDI/HDMI differential pairs).
- `index.ts` — build descriptor: exports the core to Verilog, stitches it with
  `snake_top.v`, and targets the ECP5-85F (`LFE5U-85F`, `CABGA381`).
- `*.verify.ts` / `*-check.ts` — simulation-level checks: gameplay co-sim,
  blog/editor parity, the playable harness, and a fault-injection check.

## Verify in simulation (no hardware)

```sh
pnpm --filter @simten/hardware-ulx3s run verify:snake
```

Runs the gameplay co-simulation, the parity check (the blog and editor copies
stay byte-identical to this circuit), the playable harness, and the
fault-injection check. No board or toolchain needed.

## Build and flash to a board

Synthesis runs through the local synth service (a containerized
yosys/nextpnr/ecppack). Start it:

```sh
docker run -p 8792:8080 simten-synth-local
```

Then, with a ULX3S connected over USB, build and flash from the repo root:

```sh
pnpm fpga:run --project=snake --full-rebuild
```

This regenerates the core Verilog, synthesizes it with `snake_top.v`, and flashes
the bitstream with `openFPGALoader`. Add `--no-flash` to build without flashing.
`--full-rebuild` forces a full synth + place-and-route (skipping the incremental
patch path).

If the synth service runs on a non-default port, point the client at it:

```sh
SYNTH_URL=http://localhost:PORT/synth \
BUILD_URL=http://localhost:PORT/build \
PATCH_URL=http://localhost:PORT/patch \
pnpm fpga:run --project=snake --full-rebuild
```

Steering is the board's directional buttons. The snake is drawn straight out of
the framebuffer, one byte per pixel, scanned to the screen over HDMI.

## Porting to another board or FPGA

The `Snake` core is board-agnostic: plain synthesizable Verilog exposing a
`scan_addr → pixel_out` framebuffer interface and a 2-bit `dir` input. The
core's exported Verilog doesn't change — only the board-specific parts around it
do.

- **The wrapper** (`snake_top.v`): clock/PLL, the display output, and the
  inputs. The TMDS/HDMI path here is ECP5-specific; another board might use VGA,
  a different HDMI PHY, or a parallel RGB LCD. Drive `dir` from whatever inputs
  you have, and feed `scan_addr`/`pixel_out` to your display.
- **The toolchain target**: pick the yosys synth pass and place-and-route for
  your family — `synth_ice40` + `nextpnr-ice40` (Lattice iCE40), `synth_gowin`
  for Gowin, `synth_xilinx` for 7-series, and so on. `index.ts` sets the ECP5
  device; change it for yours.
- **The constraints**: swap `ulx3s_snake.lpf` for your board's format (`.pcf`
  for iCE40, `.xdc` for Xilinx, your vendor's pin file otherwise).
