# Component Model

## The Core Invariant

**Only primitive components have executable behavior. Composites are purely structural — they describe connections, not computations.**

When you write a composite like `HalfAdder`, you're defining structure (connect Xor to And), not behavior. The behavior comes from the primitives (Xor, And) at execution time. There is no `HalfAdder.evaluate()` — it's expanded to primitives and those are evaluated.

```
node ha: HalfAdder
  → expand to: node ha_xor: Xor, node ha_and: And
  → evaluate: Xor.evaluate(), And.evaluate()
```

## Component Resolution

When the system encounters `node x: Foo`:
1. Check primitives — if found, use primitive evaluator
2. Check user-defined circuits — if found, expand composite
3. Error — unknown component

Primitives cannot be shadowed. User composites can shadow other user composites.

## Available Primitives

**Logic Gates:** And, Or, Not, Nand, Nor, Xor, Xnor, Buffer

**Bus Logic:** BusAnd, BusOr, BusNot, BusXor

**Arithmetic:** Adder, Multiplier, Comparator, Incrementer

**Routing:** Mux, Decoder, Splitter, BitSlice, Constant

**Sequential:** DFlipFlop, Register

**Memory:** RAM, ROM, DualPortRAM

**I/O:** Switch, Led, Button, Input, Probe

**Display:** SevenSegment, HexDisplay, Screen, RasterDisplay

## Adding a Primitive

All primitives live in `packages/core/src/simulator/primitives.ts` in the `PRIMITIVE_DEFINITIONS` object.

### Combinational (stateless)

```typescript
Xor3: defineCombinational({
  name: 'Xor3',
  description: '3-input XOR gate',
  category: 'logic-gates',
  icon: '⊕3',
  componentType: 'XOR3_GATE',
  inputs: [
    { name: 'a', portType: bitType() },
    { name: 'b', portType: bitType() },
    { name: 'c', portType: bitType() },
  ],
  outputs: [{ name: 'out', portType: bitType() }],
  evaluate: (inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    const c = inputs.get('c') as boolean;
    return new Map([['out', (a !== b) !== c]]);
  },
}),
```

### Sequential (stateful)

```typescript
TFlipFlop: defineSequential({
  name: 'TFlipFlop',
  description: 'Toggle flip-flop',
  category: 'sequential',
  icon: 'T',
  componentType: 'T_FLIP_FLOP',
  inputs: [{ name: 't', portType: bitType() }],
  outputs: [
    { name: 'q', portType: bitType() },
    { name: 'q_bar', portType: bitType() },
  ],
  clocks: [{ name: 'clk' }],
  state: [{ id: 'state', name: 'value', stateType: bitType(), initialValue: false }],
  evaluate: (inputs, currentState) => {
    const state = (currentState ?? false) as boolean;
    return new Map([['q', state], ['q_bar', !state]]);
  },
  updateState: (inputs, currentState, clockEdges) => {
    const t = inputs.get('t') as boolean;
    if (clockEdges['clk'] === 'rising' && t) return !currentState;
    return currentState;
  },
}),
```

### Steps

1. Add definition to `PRIMITIVE_DEFINITIONS` using `defineCombinational()` or `defineSequential()`
2. Add enum value to `ComponentType` (for UI compatibility)
3. Write tests

Everything else (Circuit IR, evaluator registry, palette metadata) is auto-generated.
