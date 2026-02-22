# Component Model Specification

**Version:** 0.1.0
**Status:** Canonical Reference

## Table of Contents

1. [Critical Principle](#critical-principle)
2. [Component Types](#component-types)
3. [Component Resolution](#component-resolution)
4. [Execution Model](#execution-model)
5. [Component Definition](#component-definition)
6. [Design Rationale](#design-rationale)

---

## Critical Principle

### The Fundamental Architectural Invariant

**Only primitive components contain executable behavior. Composite components are structural descriptions that expand into primitives.**

This is the most important architectural principle in the entire system.

### What This Means

**Primitive components** (And, Or, Not, Register, RAM, etc.):
- DO have inherent behavior
- Are implemented in TypeScript with hardcoded logic
- Have `evaluate()` functions that execute during simulation
- Cannot be expanded or redefined by users
- Form the "instruction set" of the system

**Composite components** (HalfAdder, FullAdder, ALU, etc.):
- Have NO inherent behavior
- Are PURELY structural descriptions
- Describe HOW to connect other components
- Are always expandable to primitives
- Contain NO executable logic themselves

### Example: Understanding HalfAdder

When you write:

```dsl
circuit HalfAdder {
  impl {
    node xor1: Xor
    node and1: And
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum
    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}
```

You are **NOT** defining "HalfAdder behavior." You are defining "HalfAdder structure."

The actual behavior (sum = a XOR b, carry = a AND b) comes from the **Xor and And primitives**, not from HalfAdder itself.

### Execution Flow

```
User circuit: node ha: HalfAdder
        ↓
Expansion: Replace HalfAdder with its definition
        ↓
Expanded circuit:
        node ha_xor: Xor  (primitive)
        node ha_and: And  (primitive)
        ↓
Evaluation: Execute ONLY primitive evaluators
        ↓
        ha_xor.out = Xor.evaluate(a, b)  ← Primitive behavior
        ha_and.out = And.evaluate(a, b)  ← Primitive behavior
        ↓
Output: ha.sum = ha_xor.out, ha.carry = ha_and.out
```

**There is NO separate `HalfAdder.evaluate()` function.** HalfAdder's behavior emerges from the primitive evaluations of its internal components.

### Why This Matters

1. **Complete transparency** - No hidden behavior in composites
2. **Full introspection** - Can always expand to see what's happening
3. **Predictable execution** - Behavior = primitives + connections
4. **Optimization freedom** - Can inline, flatten, reorder without changing semantics
5. **Determinism** - No hidden state or side effects in composites
6. **Debuggability** - Can single-step through primitive operations
7. **True compositionality** - Behavior composes predictably

---

## Component Types

### 1. Primitive Components

**Primitives are the ONLY components with inherent behavior.**

**Characteristics:**
- Implemented in TypeScript/JavaScript (see `/src/features/visual-editor/lib/primitive-registry.ts`)
- Have hardcoded `evaluate()` functions
- Optimized for performance
- Cannot be redefined by users
- Form the atomic building blocks of the system

**Standard Primitives:**

```typescript
// Logic Gates
And, Or, Not, Nand, Nor, Xor, Xnor, Buffer

// Sequential Components
DFlipFlop, Register

// Memory
RAM, ROM, DualPortRAM

// Arithmetic
Adder, Multiplier, Comparator, Incrementer

// Bus Operations
BusAnd, BusOr, BusNot, BusXor

// Plexers
Mux, Decoder

// Display
SevenSegment, HexDisplay, Screen, RasterDisplay

// I/O
Switch, Led, Button, Input

// Utilities
Constant, Splitter, Splitter8to8, Probe, BitSlice
```

**Primitive Definition Structure:**

```typescript
// In PRIMITIVE_DEFINITIONS (primitives.ts)
MyPrimitive: defineCombinational({
  name: 'MyPrimitive',
  description: 'What it does',
  category: 'category-name',
  icon: '⚡',
  componentType: 'MY_PRIMITIVE',
  inputs: [{ name: 'in', portType: bitType() }],
  outputs: [{ name: 'out', portType: bitType() }],
  evaluate: (inputs) => {
    // Hardcoded behavior
    const input = inputs.get('in') as boolean;
    return new Map([['out', !input]]);
  },
})
```

### 2. Composite Components

**Composites have NO inherent behavior - they are purely structural.**

**Characteristics:**
- Defined in DSL or Circuit IR
- Built from other components (primitives or composites)
- Fully expandable and inspectable
- Describe STRUCTURE (how components connect), not BEHAVIOR (what those connections do)
- Can be inlined (flattened) for optimization
- Can be kept hierarchical for clarity
- Support parameterization
- Can be saved to libraries

**Standard Library Composites (Future):**

```
Arithmetic:
  HalfAdder, FullAdder, RippleCarryAdder(width)
  Incrementer(width), Decrementer(width)
  ALU(width)

Memory:
  RegisterFile(size, width)
  Stack(depth, width)

Multiplexing:
  Mux4to1, Mux8to1, MuxNto1(n)
  Decoder2to4, Decoder3to8

Comparison:
  Comparator(width), EqualityChecker(width)

Encoding:
  Encoder, PriorityEncoder
  SevenSegmentDecoder
```

**Example: HalfAdder (DSL)**

```dsl
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

  impl {
    node xor1: Xor    // Primitive
    node and1: And    // Primitive

    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum

    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}
```

**Example: FullAdder (Reusing HalfAdder)**

```dsl
circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit

  impl {
    node ha1: HalfAdder  // Composite
    node ha2: HalfAdder  // Composite
    node or1: Or         // Primitive

    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum

    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}
```

### 3. Intrinsic Components (Special Cases)

**Note:** In the current architecture, intrinsics are implemented as primitives with special metadata. This classification is primarily conceptual.

**Characteristics:**
- Have behavior that interacts with external systems (UI, environment)
- Not purely logical (have side effects or environmental inputs)
- Examples: Switch (user input), Led (visual output), Screen (display)

**Current Implementation:**

Intrinsics are implemented as primitives with special handling:

```typescript
// Switch is a primitive with environmental state
Switch: defineCombinational({
  // ... definition ...
  hasEnvironmentalState: true,
  captureEnvironmentalState: (node) => node.arguments.value,
  restoreEnvironmentalState: (node, state) => {
    node.arguments.value = state;
  },
})
```

**Why separate conceptually?**
- UI concerns (Display, Input) don't fit pure logic model
- Environmental inputs (Switch, Button) have non-deterministic sources
- Clean conceptual separation keeps core logic model pure

---

## Component Resolution

### Resolution Order

When the system encounters a component reference like `node x1: Xor`, it resolves in this order:

1. **Primitive kernel** - Check if it's a built-in primitive
2. **Component library** - Check user-defined composite components
3. **Error** - If not found, report resolution error

### Three-Tier Resolution Model

```
Component Reference: "Xor"
        ↓
Tier 1: Check PRIMITIVES (primitives.ts)
        ↓ Found → Use primitive definition
        ↓ Not Found ↓
Tier 2: Check Component Library (IR store, user-defined circuits)
        ↓ Found → Use composite definition
        ↓ Not Found ↓
Tier 3: ERROR - Unknown component type
```

### Name Scoping Rules

- **PascalCase** for component types: `FullAdder`, `RAM`, `SevenSegmentDecoder`
- Names must start with a letter
- Can contain letters, numbers, underscores
- Must be unique within a scope

### Shadowing Rules

**User-defined components can shadow other user components, but CANNOT shadow primitives.**

```dsl
// This works - shadows library FullAdder with custom version
circuit FullAdder {
  // Custom implementation
}

// This is an ERROR - cannot shadow primitive And
circuit And {
  // ERROR: 'And' is a primitive and cannot be redefined
}
```

---

## Execution Model

### The Fundamental Execution Rule

**All execution ultimately reduces to primitive operations.**

### Execution Phases

#### Phase 1: Expansion (Compile-Time)

Composite components are expanded into their constituent parts:

1. Replace composite instances with their definitions
2. Rename internal node IDs to avoid conflicts
3. Rewire connections to parent circuit
4. Recursively expand nested composites
5. Result: Flat graph of primitive operations

**Example: Expanding HalfAdder**

Before:
```
circuit Example {
  node ha: HalfAdder
  connect a -> ha.a
  connect b -> ha.b
  connect ha.sum -> sum
}
```

After expansion:
```
circuit Example {
  node ha_xor1: Xor     // Primitive
  node ha_and1: And     // Primitive

  connect a -> ha_xor1.a
  connect b -> ha_xor1.b
  connect ha_xor1.out -> sum

  connect a -> ha_and1.a
  connect b -> ha_and1.b
  // ha_and1.out connected to carry (not shown)
}
```

#### Phase 2: Evaluation (Run-Time)

Execute primitive evaluators in topological order:

1. Build dependency graph from connections
2. Topological sort (detect cycles)
3. For each primitive in order:
   - Read input values
   - Call `primitive.evaluate(inputs, state)`
   - Write output values
4. Propagate values through connections
5. For sequential components, update state on clock edges

**Algorithm:**

```typescript
function evaluateCircuit(
  circuit: Circuit,
  inputs: Map<string, Value>
): Map<string, Value> {
  // 1. Topological sort
  const order = topologicalSort(circuit);

  // 2. Initialize port values
  const portValues = new Map(inputs);

  // 3. Evaluate primitives in order
  for (const node of order) {
    const primitive = getPrimitive(node.type);
    const inputValues = readInputs(node, portValues);
    const outputValues = primitive.evaluate(inputValues, node.state);
    writeOutputs(node, outputValues, portValues);
  }

  // 4. Return circuit outputs
  return readCircuitOutputs(circuit, portValues);
}
```

### Combinational vs Sequential Evaluation

**Combinational (no state):**
- Single evaluation pass
- Outputs computed directly from inputs
- Examples: logic gates, arithmetic ops

**Sequential (has state):**
- Two-phase evaluation:
  1. **Combinational phase** - Compute outputs and next state
  2. **Clock edge** - Update state on rising/falling edge
- Examples: flip-flops, registers, RAM

### Optimization: Inlining vs Hierarchy

**The simulator can choose to:**
- **Inline** (flatten) composites into parent circuit
- **Keep hierarchical** for debugging and clarity

**Inline when:**
- Component is small (few nodes)
- Component is used only once
- Aggressive optimization requested

**Keep hierarchical when:**
- Component is large (many nodes)
- Component is used multiple times
- Structure preservation aids debugging
- Metadata/annotations are valuable

---

## Component Definition

### Primitive Definition (TypeScript)

```typescript
// In primitives.ts
export const PRIMITIVE_DEFINITIONS = {
  MyComponent: defineCombinational({
    name: 'MyComponent',
    description: 'What the component does',
    category: 'category-name',
    icon: '🔧',
    componentType: 'MY_COMPONENT',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [
      { name: 'out', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', a && b]]);
    },
  }),
};
```

**For sequential primitives, use `defineSequential()`:**

```typescript
MyRegister: defineSequential({
  name: 'MyRegister',
  // ... inputs, outputs, category, icon ...
  clocks: [{ name: 'clk' }],
  state: [{
    id: 'reg-state',
    name: 'value',
    stateType: bitType(),
    initialValue: false
  }],
  evaluate: (inputs, currentState) => {
    // Compute outputs from state
    return new Map([['q', currentState ?? false]]);
  },
  updateState: (inputs, currentState, clockEdges) => {
    // Compute next state from inputs and clock edges
    if (clockEdges['clk'] === 'rising') {
      return inputs.get('d') as boolean;
    }
    return currentState;
  },
  createComponent: (id, initialValue) => ({
    id,
    type: 'MyRegister',
    state: initialValue ?? false,
  }),
})
```

### Composite Definition (DSL)

```dsl
circuit MyComposite {
  // Interface
  input in1: Bit
  input in2: Bus[8]
  output out: Bit

  // Parameters (optional)
  param width: Int = 8

  // Implementation
  impl {
    node component1: SomePrimitive
    node component2: AnotherComponent

    connect in1 -> component1.input
    connect component1.output -> component2.input
    connect component2.output -> out
  }
}
```

### Composite Definition (Circuit IR)

```typescript
const myComposite: Circuit = {
  id: 'MyComposite',
  name: 'MyComposite',
  parameters: [],
  inputs: [
    { name: 'in1', portType: bitType() },
    { name: 'in2', portType: busType(8) },
  ],
  outputs: [
    { name: 'out', portType: bitType() },
  ],
  clocks: [],
  state: [],
  nodes: [
    { id: 'comp1', type: 'SomePrimitive', arguments: {} },
    { id: 'comp2', type: 'AnotherComponent', arguments: {} },
  ],
  connections: [
    { from: { nodeId: '', portName: 'in1' }, to: { nodeId: 'comp1', portName: 'input' } },
    { from: { nodeId: 'comp1', portName: 'output' }, to: { nodeId: 'comp2', portName: 'input' } },
    { from: { nodeId: 'comp2', portName: 'output' }, to: { nodeId: '', portName: 'out' } },
  ],
  implementation: { kind: 'composite' },
};
```

---

## Design Rationale

### Why This Model?

**1. Primitives for Performance**
- Core operations are optimized and fast
- Native code execution (TypeScript/JavaScript)
- Can be hardware-accelerated (future WebAssembly)

**2. Composites for Flexibility**
- Users can build anything
- Encourages modular design
- Enables reusable component libraries
- No need to modify simulator for new components

**3. Clear Separation of Concerns**
- **Primitives** = WHAT (executable semantics)
- **Composites** = HOW (structural composition)
- **Separation** = predictable, debuggable, optimizable

### Why Not Make Everything Primitive?

**Problems:**
- Too rigid - users can't extend
- Bloats simulator with rarely-used components
- Prevents experimentation
- Requires C++/TypeScript skills for all components

### Why Not Make Everything Composite?

**Problems:**
- Performance - primitive operations need optimization
- Complexity - some things (RAM, I/O) are easier as primitives
- Bootstrapping - need atomic operations to build from

### Benefits of This Model

**Transparency:**
- No hidden behavior
- Can always inspect what's happening
- No "magic" composite components

**Predictability:**
- Behavior = primitives + connections
- Deterministic execution
- No surprising side effects

**Optimization:**
- Can inline, flatten, constant-fold
- Dead code elimination
- Reordering doesn't change semantics

**Debuggability:**
- Can single-step through primitive operations
- Full visibility into execution
- No black boxes

**Compositionality:**
- Behavior composes predictably
- Can reason about parts independently
- No interaction surprises

---

## Summary

### Key Takeaways

1. **Only primitives have executable behavior** - This is the fundamental architectural invariant
2. **Composites are purely structural** - They describe connections, not computations
3. **All execution reduces to primitives** - Composites expand to primitives at runtime
4. **Three-tier resolution** - Primitives → Library → Error
5. **Evaluation is topological** - Execute primitives in dependency order
6. **Clear separation** - Primitives (WHAT) vs Composites (HOW)

### Component Type Quick Reference

| Aspect | Primitive | Composite |
|--------|-----------|-----------|
| Implementation | TypeScript (hardcoded) | DSL/IR (expandable) |
| Has execute() | Yes | No (expands to primitives) |
| Expandable | No | Yes |
| Parameterizable | Limited | Yes |
| Redefinable | No | Yes (can shadow others) |
| Performance | Fastest (native code) | Depends on expansion |
| Examples | And, Register, RAM | HalfAdder, ALU, CPU |

### Related Documents

- [DSL v0.1 Specification](./DSL-and-IR-specification.md) - Language syntax and semantics
- [How to Add a Primitive](../how-to-add-primitive.md) - Implementation guide
- [Primitive Component Architecture](../ARCHITECTURE/architecture-primitive-components.md) - Implementation details
