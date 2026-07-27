# syntax=docker/dockerfile:1

# Multi-stage build:
# 1. Build the Go synthesis server
# 2. Final image with server + Yosys

# --- Stage 1: Build the Go server ---
FROM golang:1.24-alpine AS build-server

WORKDIR /app
COPY container_src/go.mod ./
RUN go mod download
COPY container_src/*.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /server

# --- Stage 2: Final image with FPGA tools ---
# OSS CAD Suite provides yosys, nextpnr-ecp5, ecppack, and more.
# Standard Debian/Ubuntu repos don't package nextpnr-ecp5 or prjtrellis.
FROM debian:bookworm-slim

# Install curl + ca-certs for downloading OSS CAD Suite
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Download OSS CAD Suite (yosys + nextpnr-ecp5 + ecppack + all ECP5 databases).
# Pinned to a dated release so image contents/size are deterministic across
# rebuilds — the old `releases/latest` pulled a new (and larger) build every
# time. Bump OSS_CAD_SUITE_DATE to upgrade deliberately.
# Releases: https://github.com/YosysHQ/oss-cad-suite-build/releases
ARG OSS_CAD_SUITE_DATE=2026-07-07
RUN COMPACT=$(echo "$OSS_CAD_SUITE_DATE" | tr -d '-') \
    && curl -fsSL "https://github.com/YosysHQ/oss-cad-suite-build/releases/download/${OSS_CAD_SUITE_DATE}/oss-cad-suite-linux-x64-${COMPACT}.tgz" -o /tmp/oss-cad-suite.tgz \
    && tar -xzf /tmp/oss-cad-suite.tgz -C /opt \
    && rm /tmp/oss-cad-suite.tgz \
    # --- Slim to the ECP5 flow (yosys + nextpnr-ecp5 + ecppack) --------------
    # The suite ships the whole OSS EDA ecosystem (~2.5 GB extracted), but this
    # container only ever runs those three tools (see container_src/main.go).
    # Pruning the unused ~1.6 GB keeps registry pushes resumable and cold starts
    # fast. MUST stay in this RUN so the bytes never land in a persisted layer.
    # Kept on purpose: nextpnr-ecp5 is built with an embedded Python interpreter
    # and Qt, so lib/python3.11 (+ libpython3.11.so) and libQt5*/libicu* are load
    # -time requirements even headless; trellis/yosys/ecp5 DBs are required. The
    # smoke test below fails the build if a future suite layout breaks the flow.
    && cd /opt/oss-cad-suite \
    && rm -rf lib/python2.7 lib/ghdl lib/ivl lib/dri lib/python3.11/test \
    && rm -f  lib/libpython2.7.so* lib/libLLVM* lib/libghdl* lib/libvvp* \
    && rm -rf share/icebox share/icons share/openFPGALoader share/openocd \
              share/nextpnr/himbaechel examples include super_prove py3bin \
    && rm -f  libexec/nextpnr-ice40 libexec/nextpnr-machxo2 libexec/nextpnr-nexus \
              libexec/surfer libexec/ivl libexec/z3 libexec/cvc4 libexec/cvc5 \
              libexec/pono libexec/prjoxide libexec/verilator_bin_dbg libexec/aigcexmin

ENV PATH="/opt/oss-cad-suite/bin:$PATH"

# Smoke test: run the real ECP5 flow so an over-aggressive prune (or a future
# suite version that relocates a database) fails the BUILD instead of shipping a
# broken image. Cheap; produces a bitstream from a trivial design.
RUN set -eux \
    && printf 'module smoke(input a,b,output y); assign y=a&b; endmodule\n' > /tmp/smoke.v \
    && yosys -q -p 'synth_ecp5 -top smoke -json /tmp/smoke.json' /tmp/smoke.v \
    && nextpnr-ecp5 --85k --json /tmp/smoke.json --textcfg /tmp/smoke.cfg --timing-allow-fail \
    && ecppack --input /tmp/smoke.cfg --bit /tmp/smoke.bit \
    && test -s /tmp/smoke.bit \
    && rm -f /tmp/smoke.*

# Copy the Go server
COPY --from=build-server /server /server

# Run as non-root so user-supplied Verilog run through yosys/nextpnr can't write
# to the root-owned toolchain. Cloudflare does NOT inject a non-root UID. The
# synth working dir (/tmp/synth/<id>) is the only writable path.
# Debian base: useradd, NOT Alpine's `adduser -D`.
RUN useradd -u 10001 -m builder && mkdir -p /tmp/synth && chown builder /tmp/synth
USER builder

EXPOSE 8080

CMD ["/server"]
