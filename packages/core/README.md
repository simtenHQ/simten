# @simten/core

The Simten simulation engine and circuit DSL — write hardware as TypeScript, simulate it cycle-accurately in any JS runtime.

This is the engine package. For most use cases you'll want one of the higher-level packages instead:

- **[`@simten/embed`](https://www.npmjs.com/package/@simten/embed)** — drop interactive simulations into a React app or web page.
- **[`@simten/mcp`](https://www.npmjs.com/package/@simten/mcp)** — let Claude design and verify circuits in your editor.

Use `@simten/core` directly when you need the simulator without UI: testing, batch verification, custom build pipelines, headless tooling.

## Install

```bash
npm install @simten/core
```

## Usage

```ts
import { circuit, bit } from '@simten/core/circuit';
import { Xor, And } from '@simten/core/std';
import { simulate } from '@simten/core/sim';

const HalfAdder = circuit('HalfAdder', {
  inputs:  { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes:   { xor1: Xor, and1: And },
  connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
    inputs.a.to(xor1.a, and1.a),
    inputs.b.to(xor1.b, and1.b),
    xor1.out.to(outputs.sum),
    and1.out.to(outputs.carry),
  ],
});

const sim = simulate(HalfAdder);
sim.set({ a: 1, b: 1 });
sim.tick();
console.log(sim.get('sum'));    // 0
console.log(sim.get('carry'));  // 1
```

The `SimulationHandle` returned by `simulate()` has a plain `dispose()` method if you need explicit cleanup; explicit-resource-management (`using`) is not currently supported.

### Running it

The snippet above is TypeScript and uses ES module syntax. Save it as `halfadder.ts` and run with [tsx](https://github.com/privatenumber/tsx):

```bash
npx tsx halfadder.ts
```

If you're running plain Node, you'd otherwise need `"type": "module"` in your `package.json` and a separate compile step — `tsx` skips both.

## Subpath exports

| Subpath | What's in it |
|---|---|
| `@simten/core` | Core types and re-exports |
| `@simten/core/circuit` | `circuit()` factory, `bit`, `bus` |
| `@simten/core/std` | Standard library components (gates, registers, RAM, ROM, adders, ALU, …) |
| `@simten/core/sim` | `simulate()` runtime |
| `@simten/core/api` | High-level entry points: `checkCircuit`, `simulateCircuit` |
| `@simten/core/verify` | Testbench harness — `declareOracle()`, `verify.check()`, `verify.run()` |
| `@simten/core/verilog` | Verilog exporter |
| `@simten/core/simulator` | Low-level simulator internals |

## Docs

Full documentation at <https://simten.dev/docs>. Source: <https://github.com/simtenHQ/simten>.

## License

Apache-2.0
