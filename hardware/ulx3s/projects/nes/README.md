# NES on the ULX3S

The simten NES (`NesConsole` from `nes/`) exported to Verilog and run on the ULX3S 85F, with HDMI out and the board's buttons as the controller. Games load over USB in about half a second, no rebuild.

## Build and flash

Needs a local [oss-cad-suite](https://github.com/YosysHQ/oss-cad-suite-build) (default `/opt/oss-cad-suite`, or set `OSS_CAD_SUITE`) and `openFPGALoader`. The design is too big for the synth container's request limits.

```
cd hardware/ulx3s
npx tsx projects/nes/build.ts --flash              # empty cart: waits for a game
npx tsx projects/nes/build.ts --flash --rom=game.nes   # boots straight into game.nes
```

About a minute on an M-series Mac. Output goes to a temp directory, so a baked ROM never ends up in the repo.

## Load a game

```
npx tsx projects/nes/load.ts game.nes
```

NROM (mapper 0) only: 16 or 32 KB PRG, 8 KB CHR.

## Controls

| Button | NES |
|---|---|
| Up / Down / Left / Right | D-pad |
| F1 | A |
| F2 | B |
| PWR | Start |

Select has no button.

## How it fits together

- `index.ts` exports `NesConsole`, the console without a cartridge, whose ports are the cartridge connector (`nes/src/cart.ts`).
- `nes_top.v` is the cartridge, an NROM flash cart, and everything around the console. PRG and CHR sit in block RAM, read on the falling edge of the NES clock so the data is there within the same dot, as from a real ROM. It also has:
  - the USB loader (1 Mbaud, holds the NES in reset while a game loads);
  - a 256×240 frame buffer;
  - 640×480 HDMI with each pixel doubled;
  - the PLL (NES clock 5.376 MHz; a real NTSC NES is 5.369).
- The TMDS encoder and serialiser are Snake's.

LEDs: 0 PLL locked (flickers while a game loads), 1 running, 2 blinks as frames are drawn, 3 CPU in cartridge code, 4-7 the direction buttons.

No sound yet: the APU isn't built.
