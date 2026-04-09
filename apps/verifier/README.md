# @turing-incomplete/verifier

Verilog verification service running inside a [Cloudflare Container](https://developers.cloudflare.com/containers/). Cross-validates exported Verilog against our simulator's trace by compiling and simulating it with [Icarus Verilog](http://iverilog.icarus.com/).

## Architecture

```
Browser ──POST /verify──→ Hono Worker ──→ Durable Object ──→ Container (sleeps after 2m)
                                                                 │
                                                     ┌──────────┼──────────┐
                                                     │  Go server (:8080)  │
                                                     │  ├── iverilog (compile)
                                                     │  └── vvp (simulate)
                                                     └─────────────────────┘
```

The container image is a two-stage Alpine build:
1. Go HTTP server (request validation, temp file management, result parsing)
2. Icarus Verilog (`iverilog` + `vvp`) from Alpine packages

The Go server writes the Verilog source and testbench to a temp directory, compiles with `iverilog`, runs with `vvp`, parses structured `RESULT|...` lines from stdout, and returns the results as JSON. Temp files are cleaned up on every request. Simulation has a 10-second timeout.

## API

### `POST /verify`

Compile and simulate Verilog with a testbench.

**Request:**
```json
{
  "verilog": "module HalfAdder(input a, input b, output sum, output carry); ...",
  "testbench": "module tb; ... initial begin ... end endmodule"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `verilog` | string | yes | Verilog source (the design under test) |
| `testbench` | string | yes | Verilog testbench that exercises the design |

**Response:**
```json
{
  "success": true,
  "results": [
    { "testCase": 0, "cycle": 1, "outputs": { "sum": 0, "carry": 1 } }
  ],
  "simulationLog": "..."
}
```

On failure:
```json
{
  "success": false,
  "compileError": "iverilog compilation failed: ...",
  "iverilogStderr": "..."
}
```

**Limits:** 120KB max request body. 10-second simulation timeout.

### `GET /`

Health check. Returns `{ "status": "healthy", "service": "verilog-verifier" }`.

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

## Testing

The Verilog *exporter* is tested in `packages/core/src/verilog/__tests__/exporter.test.ts`. The verifier service itself does not have automated tests in CI — it requires Docker to build the container. To manually verify:

```bash
pnpm dev
# In another terminal:
curl -X POST http://localhost:8787/verify \
  -H 'Content-Type: application/json' \
  -d '{"verilog": "module top(input a, output b); assign b = a; endmodule", "testbench": "module tb; reg a; wire b; top uut(.a(a), .b(b)); initial begin a=0; #10; a=1; #10; $finish; end endmodule"}'
```
