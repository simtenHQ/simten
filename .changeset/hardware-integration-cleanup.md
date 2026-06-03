---
"@simten/hardware-ulx3s": patch
---

Hardware integration cleanup: import `@simten/core` via its package aliases instead of deep `../../../../packages/core/src/...` paths; run the `fpga:*` scripts on a single runtime (tsx — replacing the bun-only `import.meta.dir`/`import.meta.main`); move the scripts into the package's own `package.json` with thin root delegators; and run the RV32I ISA suite plus the netlist byte-identity guard in CI so the FPGA path can't silently drift.
