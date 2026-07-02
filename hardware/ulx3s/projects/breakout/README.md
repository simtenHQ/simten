# Breakout on the ULX3S

A complete Breakout game — paddle, bouncing ball, 128 destructible bricks —
running as pure logic on the ULX3S ECP5-85F and driving an HDMI monitor. No CPU,
no software.

## What's here

| File | Purpose |
|------|---------|
| `breakout_core.v` | The game, exported to synthesizable Verilog from the blog circuit (`apps/web/src/features/blog/breakout-in-hardware/circuits.ts`). Combinational raster render (`scan_addr` → `pixel_out`), a `brickRAM` collision map, and a fill FSM that redraws the wall. |
| `breakout_top.v` | Board wrapper: 25 MHz PLL, 640×480 VGA timing, a 32×16 cell grid feeding `scan_addr`, a ~30 Hz `game_en` clock enable, button → `keyboard` input, colour-by-row, and a TMDS/DVI encoder. |
| `ulx3s_breakout.lpf` | Pin constraints: `clk_25mhz`, `btn[5]`/`btn[6]` (left/right), `gpdi` HDMI pairs. |
| `breakout.bit` | Prebuilt bitstream. |
| `index.ts` | Project descriptor (auto-discovered by the pipeline). |

## Controls

- **btn5** — move paddle left
- **btn6** — move paddle right

Miss the ball and the wall instantly redraws and a fresh ball launches.

## Clocking

The Breakout core is clocked at the 25 MHz pixel clock, so the wall-fill FSM
redraws all 128 bricks in ~5 µs (instant). The playable game rate comes from a
`game_en` clock enable pulsed at ~30 Hz — the ball and paddle only step on that
pulse, while the video scan runs continuously and `pixel_out` is combinational.

## Build & flash

```
# rebuild the bitstream (needs the apps/synth container on :8788)
pnpm fpga:build --project=breakout

# flash to SRAM (volatile; clears on power cycle)
openFPGALoader -b ulx3s hardware/ulx3s/projects/breakout/breakout.bit
```

Connect an HDMI display to the GPDI port. Synthesis reports ~1300 LUTs, 240 FFs,
0 BRAM, timing closing at >230 MHz against a 25 MHz clock.
