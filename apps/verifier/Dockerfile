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

# Create temp directory for verifications
RUN mkdir -p /tmp/verify

EXPOSE 8080

CMD ["/server"]
