# Examples

## Half Adder

Two bits → sum + carry. The foundation of binary arithmetic.

```typescript
import { circuit, bit } from '@turing-incomplete/core/circuit'
import { Xor, And } from '@turing-incomplete/core/std'

export const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  nodes: { xor1: Xor, and1: And },
  connect: ({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ],
})
```

## Full Adder (composite)

Built from two half adders + an OR gate.

```typescript
import { circuit, bit } from '@turing-incomplete/core/circuit'
import { Or } from '@turing-incomplete/core/std'
import { HalfAdder } from './half-adder'

export const FullAdder = circuit('FullAdder', {
  in: { a: bit, b: bit, cin: bit },
  out: { sum: bit, cout: bit },
  nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
  connect: ({ in: inp, out, ha1, ha2, or1 }) => [
    inp.a.to(ha1.a),
    inp.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inp.cin.to(ha2.b),
    ha2.sum.to(out.sum),
    ha1.carry.to(or1.a),
    ha2.carry.to(or1.b),
    or1.out.to(out.cout),
  ],
})
```

## 2-bit Counter (sequential)

Two flip-flops counting 00 → 01 → 10 → 11 → repeat.

```typescript
import { circuit, bit } from '@turing-incomplete/core/circuit'
import { DFlipFlop, Not, Xor } from '@turing-incomplete/core/std'

export const Counter2Bit = circuit('Counter2Bit', {
  out: { bit0: bit, bit1: bit },
  nodes: { dff0: DFlipFlop, dff1: DFlipFlop, inv: Not, xor1: Xor },
  connect: ({ out, dff0, dff1, inv, xor1 }) => [
    dff0.q.to(inv.in, xor1.b, out.bit0),
    inv.out.to(dff0.d),
    dff1.q.to(xor1.a, out.bit1),
    xor1.out.to(dff1.d),
  ],
})
```

## Simulating

```typescript
import { simulate } from '@turing-incomplete/core/sim'

const sim = simulate(HalfAdder)

sim.set({ a: 1, b: 1 })
sim.get('sum')   // 0
sim.get('carry') // 1

sim.dispose()
```

## Embedding in React

```tsx
import { CircuitEmbed } from '@turing-incomplete/embed'

<CircuitEmbed circuit={HalfAdder} />
```

The embed auto-generates Switch nodes for inputs and Led nodes for outputs.
