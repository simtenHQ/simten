# @simten/hardware-ulx3s

## 0.0.7

### Patch Changes

- b67cc0b: Hardware integration cleanup: import `@simten/core` via its package aliases instead of deep `../../../../packages/core/src/...` paths; run the `fpga:*` scripts on a single runtime (tsx — replacing the bun-only `import.meta.dir`/`import.meta.main`); move the scripts into the package's own `package.json` with thin root delegators; and run the RV32I ISA suite plus the netlist byte-identity guard in CI so the FPGA path can't silently drift.

## 0.0.6

### Patch Changes

- d51b424: Add canonical `RV32I_Core` to `@simten/core/std` as the single source of truth for the 5-stage pipelined RV32I CPU datapath (previously hand-wired and drifting across three copies). The FPGA build now imports it instead of an inline copy — verified byte-identical at the flattened-netlist level and locked by a CI guard (`dump-netlist --check` against a hardware-provenanced golden). An optional `debug` flag exposes a register scan port and the five pipeline-stage PCs as outputs.
- Updated dependencies [d51b424]
  - @simten/core@0.3.0

## 0.0.5

### Patch Changes

- Updated dependencies [e87c2a5]
  - @simten/core@0.2.4

## 0.0.4

### Patch Changes

- Updated dependencies [3e4aaeb]
- Updated dependencies [3e4aaeb]
  - @simten/core@0.2.3

## 0.0.3

### Patch Changes

- Updated dependencies [c7c5e67]
  - @simten/core@0.2.2

## 0.0.2

### Patch Changes

- Updated dependencies [2649b7c]
  - @simten/core@0.2.1

## 0.0.1

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @simten/core@0.2.0
