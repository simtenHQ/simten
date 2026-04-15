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

# --- Stage 2: Final image with Yosys ---
FROM debian:bookworm-slim

# Install Yosys
RUN apt-get update && apt-get install -y --no-install-recommends yosys && rm -rf /var/lib/apt/lists/*

# Copy the Go server
COPY --from=build-server /server /server

# Create temp directory for synthesis runs
RUN mkdir -p /tmp/synth

EXPOSE 8080

CMD ["/server"]
