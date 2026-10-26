# 0007. Yosys, iverilog, nextpnr and gcc in containers

**Status:** Accepted. Tracked in #442.

## Context

Verilog import needs Yosys. Verification against a reference needs iverilog. FPGA builds need Yosys, nextpnr and ecppack, and the RISC-V examples need a cross gcc. These run in three Cloudflare containers (compiler, synth, verifier) behind small Worker gateways.

## Decision

Run the toolchains on servers, one container per toolchain image. The FPGA and gcc toolchains are hundreds of megabytes and slow to start, and synthesis and place-and-route are CPU-heavy, so they don't belong in a browser tab. Separate containers keep each image small and let each be deployed on its own.

## Rejected

- **YoWASP (Yosys and nextpnr compiled to WASM) in the browser.** Works, and removes the server, but it's a large download and slow for anything beyond small designs. No WASM build exists for the RISC-V gcc we use.
- **One container for everything.** One huge image, and one slow rebuild whenever any toolchain changes.

## What would change it

Verilog import is the best candidate to move to the browser with YoWASP's Yosys: inputs are small, and it would remove a network round trip and a container. Worth doing if import becomes a common path or the synth container's cost matters.
