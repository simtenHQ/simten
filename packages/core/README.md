# @simten/core

The Simten simulation engine and circuit DSL — write hardware as TypeScript, simulate it cycle-accurately in any JS runtime.

This is the engine package. For most use cases you'll want one of the higher-level packages instead:

- **[`@simten/react`](https://www.npmjs.com/package/@simten/react)**: put interactive simulations in a React app. On any other page, use the iframe embed from Share > Embed on simten.dev.
- **[`@simten/mcp`](https://www.npmjs.com/package/@simten/mcp)** — let Claude design and verify circuits in your editor.

Use `@simten/core` directly when you need the simulator without UI: testing, batch verification, custom build pipelines, headless tooling.

## Install

```bash
npm install @simten/core
```

## Usage

```ts
import { circuit, bit, simulate } from '@simten/core';
import { Xor, And } from '@simten/core/std';

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

`simulate()` returns a `Simulation`. There is nothing to clean up afterwards. `sim.tick(n)` runs n clock edges, `sim.reset()` goes back to cycle 0 (the reset line: inputs stay where they are), and `simulate(top, { history: 100 })` keeps the last 100 steps for `stepBack()`, `stepForward()` and `seek(index)`.

`sim.set` takes input port names and the paths of Switch and Input nodes, so a circuit driven by switches is driven the same way: `sim.set({ d: 0, en: 0 })`. Every value is written before the circuit settles. `simulate(top, { memory: { rom: { 0: 0x11 } } })` loads memory contents by node path before cycle 0, and `reset()` keeps them.

### Running it

The snippet above is TypeScript and uses ES module syntax. `@simten/core` is ESM-only, so the consuming project needs to be in ESM mode too. Either:

```bash
# package.json with `"type": "module"`, then:
npx tsx halfadder.ts
```

or skip the package.json entirely by using the `.mts` extension:

```bash
# save as halfadder.mts
npx tsx halfadder.mts
```

[tsx](https://github.com/privatenumber/tsx) handles the TypeScript transform; the ESM signal comes from `"type": "module"` or the `.mts` extension. Plain `node halfadder.ts` won't work — Node needs both the TypeScript transform and the ESM signal.

## Subpath exports

| Subpath | What's in it |
|---|---|
| `@simten/core` | `circuit()`, `bit`, `bus`, `simulate()` and the `Circuit` type |
| `@simten/core/std` | Standard library components (gates, registers, RAM, ROM, adders, ALU, …) |
| `@simten/core/verify` | Testbench harness: `declareOracle()`, `verify.check()`, `verify.run()` |
| `@simten/core/verilog` | Verilog exporter |
| `@simten/core/examples` | Complete example circuits and the example catalog |
| `@simten/core/internal` | Engine, IR and tool handlers used by Simten's own packages. No stability promise |

## Docs

Full documentation at <https://simten.dev/docs>. Source: <https://github.com/simtenHQ/simten>.

## License

Apache-2.0
