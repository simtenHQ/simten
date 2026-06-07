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
# Fetches the latest release from YosysHQ automatically.
# To pin a version, replace the curl+jq approach with a direct URL:
#   https://github.com/YosysHQ/oss-cad-suite-build/releases/download/YYYY-MM-DD/oss-cad-suite-linux-x64-YYYYMMDD.tgz
RUN LATEST_URL=$(curl -fsSL "https://api.github.com/repos/YosysHQ/oss-cad-suite-build/releases/latest" \
      | grep '"browser_download_url"' \
      | grep 'linux-x64' \
      | grep -v '\.sha256' \
      | head -1 \
      | cut -d'"' -f4) \
    && curl -fsSL "$LATEST_URL" -o /tmp/oss-cad-suite.tgz \
    && tar -xzf /tmp/oss-cad-suite.tgz -C /opt \
    && rm /tmp/oss-cad-suite.tgz

ENV PATH="/opt/oss-cad-suite/bin:$PATH"

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
