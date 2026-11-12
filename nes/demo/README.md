# NES in the browser

The NES from `nes/src`, exported to Verilog, compiled with CXXRTL to WebAssembly, and run at full speed in a page. Pick an NROM (mapper 0) `.nes` file; play with the arrow keys, X or Space (A), Z (B), Enter (Start) and Shift (Select).

## Build and run

Needs Yosys (oss-cad-suite) and Emscripten on the `PATH`. From `nes/`:

```
npx tsx demo/build.ts
../apps/web/node_modules/.bin/vite demo --port 5199
```

`build.ts` writes one WebAssembly build per cartridge shape (16 or 32 KB of PRG, horizontal or vertical mirroring) into `demo/public/`. With `--check=game.nes` it first runs that game on the build and on the whole NES as one model, natively, and fails unless every frame and every audio sample match.

## Why two models

Simulated as one design, the NES runs at about 0.65x real time in the browser: CXXRTL evaluates the whole design on every PPU dot, though the CPU side (the 2A03: the 6502, APU and DMA) only does anything on every third. `halves.ts` cuts the NES at the 2A03/2C02 boundary, the same line the real board has, and `split.cc` steps the CPU side once per CPU cycle and the PPU side every dot. Between them run the PPU's register port and NMI.

The CPU side is evaluated before the PPU has answered, and again only on the few hundred cycles a frame that read or write a PPU register. That takes it to about 1.0x. The harness reads two of the PPU's register names from the generated C++ (`vbl`, `ctrl`), so it is tied to this design; renaming them breaks the build, not the result.

## The page

`worker.ts` runs a frame, sends it, and paces the next against the clock, steered by the page's sound queue so the sound stays about 40 ms behind. Sound goes out in quarter frames, frames are drawn on the display's refresh, and a button tapped between two frames is held for one.
