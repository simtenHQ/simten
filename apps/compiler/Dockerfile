# syntax=docker/dockerfile:1

# Multi-stage build:
# 1. Build the Go compilation server
# 2. Final image with server + toolchains (RISC-V GCC + Rust)

# --- Stage 1: Build the Go server ---
FROM golang:1.24-alpine AS build-server

WORKDIR /app
COPY container_src/go.mod ./
RUN go mod download
COPY container_src/*.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /server

# --- Stage 2: Final image with toolchains ---
FROM alpine:3.21

# Install RISC-V GCC cross-compiler (handles C, C++, assembly)
RUN apk add --no-cache \
    gcc-riscv-none-elf \
    g++-riscv-none-elf \
    newlib-riscv-none-elf \
    binutils-riscv-none-elf \
    curl \
    && rm -rf /var/cache/apk/*

# Strip unused RV32 multilib variants (keep only rv32i/ilp32 which we target)
# This saves ~600MB — newlib ships pre-compiled libs for every RV32 sub-extension combo
RUN cd /usr/riscv-none-elf/lib && \
    find . -maxdepth 1 -type d -name 'rv32*' ! -name 'rv32i' -exec rm -rf {} + && \
    cd /usr/lib/gcc/riscv-none-elf/14.2.0 && \
    find . -maxdepth 1 -type d -name 'rv32*' ! -name 'rv32i' -exec rm -rf {} + 2>/dev/null; \
    true

# Install Rust with riscv32i target (minimal profile — no cargo, clippy, etc.)
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --default-toolchain stable --profile minimal && \
    rustup target add riscv32i-unknown-none-elf && \
    rm -rf /usr/local/cargo/registry /tmp/* && \
    # Remove host target stdlib (we only cross-compile, never run on host)
    rm -rf /usr/local/rustup/toolchains/*/lib/rustlib/aarch64-unknown-linux-musl/lib && \
    rm -rf /usr/local/rustup/toolchains/*/lib/rustlib/x86_64-unknown-linux-gnu/lib && \
    # Remove docs and unnecessary files
    rm -rf /usr/local/rustup/toolchains/*/share && \
    # Remove curl (only needed for rustup install)
    apk del curl

# Copy the Go server
COPY --from=build-server /server /server

# Create temp directory for compilations
RUN mkdir -p /tmp/compile

EXPOSE 8080

CMD ["/server"]
