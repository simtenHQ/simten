# Hardware

FPGA targets for Simten. Currently one board: **ULX3S 85F** (Lattice ECP5 LFE5U-85F, CABGA381).

```
hardware/
└── ulx3s/
    ├── lib/                     shared TypeScript: pipeline, serial capture, ecpbram, synth-client
    ├── projects/                one folder per FPGA project (auto-discovered)
    │   ├── cpu/                 RV32I CPU, runs C / Rust firmware over UART
    │   ├── snake/               HDMI Snake (no firmware, all RTL)
    │   └── uart_test/           standalone UART smoke test
    └── run_on_fpga.ts           unified CLI: build → synth → flash → UART capture
```

## Running a project on the board

The unified entry point is `run_on_fpga.ts`. Same CLI is exposed as the MCP tool
`mcp__simten__run_on_fpga` so Claude Code can drive the board directly.

```bash
# CPU + Rust firmware
pnpm fpga:run --project=cpu \
  --firmware=hardware/ulx3s/projects/cpu/firmware/hello.rs \
  --match='Hello, World!' --timeout=5000

# CPU + C firmware
pnpm fpga:run --project=cpu \
  --firmware=hardware/ulx3s/projects/cpu/firmware/fibonacci.c \
  --match='514229' --timeout=10000

# Standalone UART
pnpm fpga:run --project=uart_test --match='HELLO'

# Snake (HDMI; no UART to capture)
pnpm fpga:run --project=snake
```

The pipeline:

1. **Compile** (CPU project only) — POSTs firmware source to the remote compiler service
   (`apps/compiler`) which runs `riscv32-unknown-elf-gcc` (C) or `rustc --target=riscv32i-…` (Rust)
   and returns a base64 RV32I binary. Detected by extension (`.c` / `.rs`).
2. **Synth** — `apps/verifier`-adjacent flow: Yosys → nextpnr-ecp5 → ecppack. Cached by
   `(verilog, top, lpf, device)` hash; reuses prior bitstream when only firmware changed
   (uses `ecpbram` to swap the IMEM init image into the cached `.bit`).
3. **Flash** — `openFPGALoader -b ulx3s`. Kills any running `picocom` first to release
   `/dev/cu.usbserial-*`.
4. **UART capture** (when project declares `uart`) — opens the port, reads bytes until
   `match` regex hits or `timeout_ms` elapses. Returns a structured `RunResult` JSON.

`--full-rebuild` skips the bitstream cache; `--no-flash` builds only.

## Adding a project

Drop `hardware/ulx3s/projects/<name>/index.ts` exporting a `Project` descriptor and the
auto-discovery in `projects/index.ts` will pick it up. A project provides:

```ts
export const project: Project = {
  name: '<name>',
  projectDir: __dirname,
  bitFile: '<name>.bit',
  uart: { baud: 115200 },        // optional; omit if no UART output
  firmware: true,                // optional; require --firmware=<path>
  async buildVerilog(ctx) {
    return {
      verilog: '...',            // top-level + dependencies concatenated
      topModule: '<name>_top',
      lpf: '...',                // ULX3S pin assignments
      device: { chip: 'LFE5U-85F', package: 'CABGA381', sizeFlag: '85k' },
      extraFiles: { ... },       // e.g. firmware.hex for $readmemh
    };
  },
};
```

Snake demonstrates building Verilog from a TypeScript `circuit()` graph via
`exportVerilog` — useful when you want a Simten-built design on real silicon.

> **Wrappers must drive `rst_n`.** The exporter auto-emits a synchronous
> active-low `rst_n` input port on every module containing sequential logic.
> A typical wrapper combines a power-on-reset counter (holds `rst_n` low for
> the first ~256 cycles after bitstream load) with an optional physical
> button. See `projects/cpu/cpu_top.v` for a worked example.

## Demo status

| Project       | Firmware              | Result               | Notes                                       |
|---------------|-----------------------|----------------------|---------------------------------------------|
| `cpu`         | `firmware/hello.rs`   | ✓ "Hello, World!\r\n" | RV32I no_std Rust, polling UART             |
| `cpu`         | `firmware/hello.c`    | ✓ "Hi there\r\n"      | Was flaky pre-skid-fix (see UART notes)     |
| `cpu`         | `firmware/fibonacci.c`| ✓ fib through 832040  | Uses `putc` / `puts_` / `putn` over UART    |
| `cpu`         | `firmware/snake.c`    | (untested on FPGA)    | Snake game running on the soft CPU          |
| `uart_test`   | —                     | ✓ "HELLO\r\n"         | Pure-Verilog smoke test, ~52 FFs            |
| `snake`       | —                     | ✓ build + flash       | HDMI output; needs a display to verify      |

## CPU project notes

- **Memory map.** IMEM at `0x0000_0000` (2 KB, 512 × 32-bit, `$readmemh("firmware.hex")`),
  DMEM at `0x0001_0000` (4 KB, 1024 × 32-bit), UART MMIO at `0x8000_0000` (TX data write,
  TX-ready read on bit 0).
- **UART (`uart_tx_bb` in `cpu_top.v`).** 8N1, 115200 baud, 25 MHz clock → 217 cycles/bit.
  Has a **1-deep skid buffer** (`skid_data`/`skid_valid`) — `tx_ready = !skid_valid`,
  so a write that arrives while the shifter is mid-byte (or during the cycle `busy` is
  flipping) is captured rather than dropped. This was added after observing intermittent
  byte corruption on `hello.c` (tight write loop with no inter-byte slack); `hello.rs`
  and `fibonacci.c::putc` had enough function-call overhead to mask the race. Software
  contract is unchanged: `while (!(*UART & 1)); *UART = c;` works correctly.
- **Pipeline bringup history.** See `projects/cpu/DEBUG.md` for the chronological log
  of getting the RV32I core to run C firmware (load-use hazards on rs1/rs2, encoding
  bugs, byte-offset LBU, etc.).

## Files of interest

- `lib/pipeline.ts` — orchestrates compile → synth → flash; cache logic and `firmwareLanguage` detection live here
- `lib/serial.ts` — Node `serialport` wrapper with regex-match early-exit
- `lib/synth-client.ts` — POSTs Verilog to the synth service, polls until done, downloads bitstream
- `lib/ecpbram.ts` — invokes `ecpbram` to swap firmware blobs into a cached bitstream
- `projects/cpu/sim.ts` / `run_c.ts` — run firmware through the TypeScript RTL simulator
  without touching the FPGA. Useful for "is the bug downstream of the simulator?" triage
- `run_on_fpga.ts` — argv parsing, picocom kill, structured `RunResult` emission

## Toolchain prerequisites

### On your machine

- **`openFPGALoader`** — flashes the bitstream to the board over JTAG.
- **`picocom`** *(optional)* — live UART monitoring outside the CLI (`pnpm fpga:console`).
- **Node + `serialport`** — already pulled in by the repo's `package.json`.
- **Docker** — required for the synth / verify / compile services below (each `wrangler dev` invocation builds and runs a container).
- **Linux only:** `openFPGALoader` typically needs udev rules to access the FT232 without `sudo`. See [openFPGALoader README](https://github.com/trabucayre/openFPGALoader#udev-rules).

The heavyweight EDA toolchain — Yosys, nextpnr-ecp5, ecppack, riscv-gcc, Icarus Verilog — runs **inside three container services** (`apps/synth`, `apps/verifier`, `apps/compiler`), so you do *not* install them on your machine. You do need to run those services locally.

### Running the services

`apps/synth`, `apps/verifier`, and `apps/compiler` are private Cloudflare workers — their public `*.workers.dev` URL is disabled (they're only reachable via service binding from `@simten/web` in production; see issue [#59](https://github.com/simtenHQ/simten/issues/59)). To use the FPGA flow from a fresh clone, start them locally in three terminals:

```bash
pnpm dev:synth       # Yosys + nextpnr-ecp5 + ecppack    (port 8792)
pnpm dev:verifier    # Icarus Verilog                     (port 55002)
pnpm dev:compiler    # riscv32-unknown-elf-gcc + rustc    (port 55001)
```

Each runs under `wrangler dev` and brings up its Docker container on first hit.

### Environment variables

`run_on_fpga.ts` and the verify scripts read these (defaults shown line up with the local-services ports above):

| Variable        | Default                            | Used by                                       |
|-----------------|------------------------------------|-----------------------------------------------|
| `SYNTH_URL`     | `http://localhost:8792/synth`      | `lib/synth-client.ts` → Yosys                 |
| `BUILD_URL`     | `http://localhost:8792/build`      | `lib/synth-client.ts` → nextpnr + ecppack     |
| `PATCH_URL`     | `http://localhost:8792/patch`      | `lib/synth-client.ts` → ecpbram patch path    |
| `VERIFIER_URL`  | `http://localhost:55002/verify`    | `projects/cpu/verify.ts`, `cycle-diff.ts`     |
| `COMPILER_URL`  | `http://localhost:55001/compile`   | `projects/cpu/{verify,run_c,index}.ts`        |

Override any of these to point at a self-hosted deployment of the same containers.
