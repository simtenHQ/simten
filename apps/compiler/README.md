# @simten/compiler

RISC-V cross-compiler running inside a [Cloudflare Container](https://developers.cloudflare.com/containers/). Compiles C, C++, Rust, and raw assembly into rv32i machine code so users can write programs in the browser and execute them on the simulated CPU — without shipping a 50MB toolchain to the client.

## Architecture

```
Browser ──POST /compile──→ Hono Worker ──→ Durable Object ──→ Container (sleeps after 2m)
                                                                  │
                                                      ┌──────────┼──────────┐
                                                      │  Go server (:8080)  │
                                                      │  ├── riscv-none-elf-gcc (C/C++/asm)
                                                      │  └── rustc --target riscv32i (Rust)
                                                      └─────────────────────┘
```

The container image is a multi-stage Alpine build:
1. Go compilation server (handles routing, sandboxing, output parsing)
2. RISC-V GCC cross-compiler (`gcc-riscv-none-elf`, `newlib-riscv-none-elf`) with unused multilib variants stripped (~600MB saved)
3. Rust with the `riscv32i-unknown-none-elf` target (minimal profile)

## API

### `POST /compile`

Compile source code to RISC-V machine code.

**Request:**
```json
{
  "source": "int main() { return 42; }",
  "language": "c",
  "linkerScript": "...",
  "disassemble": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | string | yes | Source code to compile |
| `language` | string | no | `c` (default), `cpp`, `rust`, or `asm` |
| `linkerScript` | string | no | Custom linker script |
| `disassemble` | boolean | no | Include disassembly in response |

**Response:** compiled binary (as JSON with base64-encoded bytes), disassembly if requested, or error details.

**Limits:** 60KB max request body.

### `GET /`

Health check. Returns container status.

## Local Development

Requires Docker for the container build.

```bash
pnpm dev          # Start with wrangler (builds container)
pnpm build:container  # Build Docker image only
```

## Deploy

```bash
pnpm deploy       # Deploy to Cloudflare via wrangler
```
