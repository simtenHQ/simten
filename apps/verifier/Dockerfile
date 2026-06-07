# syntax=docker/dockerfile:1

# Multi-stage build:
# 1. Build the Go verification server
# 2. Final image with server + Icarus Verilog

# --- Stage 1: Build the Go server ---
FROM golang:1.24-alpine AS build-server

WORKDIR /app
COPY container_src/go.mod ./
RUN go mod download
COPY container_src/*.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /server

# --- Stage 2: Final image with Icarus Verilog ---
FROM alpine:3.21

# Install Icarus Verilog
RUN apk add --no-cache iverilog && rm -rf /var/cache/apk/*

# Copy the Go server
COPY --from=build-server /server /server

# Run as non-root so user-supplied Verilog run through iverilog can't write to
# the root-owned toolchain. Cloudflare does NOT inject a non-root UID. The
# verify working dir (/tmp/verify/<id>) is the only writable path.
RUN adduser -D -u 10001 builder && mkdir -p /tmp/verify && chown builder /tmp/verify
USER builder

EXPOSE 8080

CMD ["/server"]
