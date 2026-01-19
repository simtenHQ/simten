# Component Library Model

## Overview

This document describes how components are organized, resolved, and executed in the Turing Incomplete system.

## CRITICAL PRINCIPLE: Component Behavior

**Only primitive components contain executable behavior. Composite components are structural descriptions that expand into primitives.**

**What this means:**
- **Primitive components** (And, Or, Not, Register, RAM, etc.) DO have inherent behavior - they are implemented in TypeScript with hardcoded logic
- **Composite components** have NO inherent behavior - they are PURELY structural descriptions of how to connect other components
- ALL execution ultimately reduces to primitive operations
- There is no "magic" behavior hiding in composite components
- During simulation, composites are either expanded (inlined) to primitives, or optimized away entirely

**Example:**
```
HalfAdder component has no "addition logic"
└─> It ONLY describes how to connect Xor and And primitives
    └─> Xor and And DO have hardcoded logic (primitive evaluators)
        └─> At runtime, HalfAdder.sum = Xor.out (structural fact, not behavior)
```

This architectural invariant ensures:
- Complete transparency (no hidden behavior in composites)
- Full introspection (can always expand to see what's happening)
- Predictable execution (behavior = primitives + connections)
- Optimization freedom (can inline, flatten, reorder without changing semantics)

## Three Types of Components

### 1. Primitive Components (Simulator Kernel)

**Primitives are the ONLY components with inherent behavior.**

Primitives are the foundational building blocks provided by the simulator. They have no DSL implementation - their behavior is hardcoded in the simulator engine. This is the ONLY place where actual logic execution happens.

**Characteristics:**
- Implemented in TypeScript/JavaScript
- Optimized for performance
- Cannot be redefined by users
- Form the "instruction set" of the system

**Standard Primitives:**

```typescript
// Basic logic gates
And, Or, Not, Nand, Nor, Xor, Xnor, Buffer

// State elements
Register, RegisterN, DFF (D Flip-Flop)

// Memory
RAM, ROM

// Arithmetic (optimized implementations)
Add, Sub, Mult (for performance)

// Multiplexing
Mux, Demux

// Comparison
Equal, LessThan, GreaterThan

// Bit manipulation
And (bitwise), Or (bitwise), Xor (bitwise), Not (bitwise)
ShiftLeft, ShiftRight, RotateLeft, RotateRight
```

**Primitive Definition Format:**

```typescript
interface PrimitiveDefinition {
  name: string;
  inputs: PortDescriptor[];
  outputs: PortDescriptor[];
  clocks: ClockDescriptor[];
  evaluate: (inputs: Map<string, BitValue | BusValue>) => Map<string, BitValue | BusValue>;
}
```

**Example: And Gate**

```typescript
const And: PrimitiveDefinition = {
  name: 'And',
  inputs: [
    { name: 'a', portType: { kind: 'bit' } },
    { name: 'b', portType: { kind: 'bit' } }
  ],
  outputs: [
    { name: 'out', portType: { kind: 'bit' } }
  ],
  clocks: [],
  evaluate: (inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', a && b]]);
  }
};
```

**Example: Register**

```typescript
const Register: PrimitiveDefinition = {
  name: 'Register',
  inputs: [
    { name: 'd', portType: { kind: 'bit' } }
  ],
  outputs: [
    { name: 'q', portType: { kind: 'bit' } }
  ],
  clocks: [
    { name: 'clk' }
  ],
  evaluate: (inputs, state, clocks) => {
    // On rising edge, capture input
    if (clocks.get('clk')?.edge === 'rising') {
      state.set('value', inputs.get('d'));
    }
    // Output is current state
    return new Map([['q', state.get('value') ?? false]]);
  }
};
```

### 2. Composite Components (Library and User-Defined)

**Composites have NO inherent behavior - they are purely structural.**

Composite components are built from other components (primitives or composites). They are fully expandable and inspectable. Composites describe STRUCTURE (how components connect), not BEHAVIOR (what those connections do).

**Characteristics:**
- Defined in DSL or IR
- Can be inlined (flattened) for optimization
- Can be collapsed (kept hierarchical) for clarity
- Support parameterization
- Can be saved to libraries

**Standard Library Composites:**

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

```
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

  impl {
    node x1: Xor
    node a1: And

    connect a -> x1.a
    connect b -> x1.b
    connect x1.out -> sum

    connect a -> a1.a
    connect b -> a1.b
    connect a1.out -> carry
  }
}
```

**Example: FullAdder (Reusing HalfAdder)**

```
circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit

  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or

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

**Parameterized Example: N-bit Adder**

```
circuit RippleCarryAdder(width: Int) {
  input a: Bus[width]
  input b: Bus[width]
  input cin: Bit
  output sum: Bus[width]
  output cout: Bit

  impl {
    // This would be generated/expanded based on width parameter
    // For width=4:
    node fa0: FullAdder
    node fa1: FullAdder
    node fa2: FullAdder
    node fa3: FullAdder

    // Chain carry bits
    connect cin -> fa0.cin
    connect fa0.cout -> fa1.cin
    connect fa1.cout -> fa2.cin
    connect fa2.cout -> fa3.cin
    connect fa3.cout -> cout

    // Connect data bits
    connect a[0] -> fa0.a
    connect b[0] -> fa0.b
    connect fa0.sum -> sum[0]
    // ... (repeat for other bits)
  }
}
```

### 3. Intrinsic Components (Foreign/Special)

Intrinsics have special behavior that cannot be expressed purely in terms of logic. They interact with the UI, debugger, or other external systems.

**Characteristics:**
- Implemented in simulator with custom logic
- Not expandable
- Used for I/O, visualization, debugging

**Standard Intrinsics:**

```
Display - Shows value visually (LED, 7-segment, etc.)
Input - Accepts user input (switch, button, etc.)
DebugProbe - Captures values for debugging
PerformanceCounter - Measures timing/performance
Random - Generates random values
Clock - Generates clock signals
```

**Example: Display (Intrinsic)**

```typescript
const Display: IntrinsicDefinition = {
  name: 'Display',
  inputs: [
    { name: 'value', portType: { kind: 'bit' } }
  ],
  outputs: [],
  behavior: (inputs, uiContext) => {
    // Update UI representation
    uiContext.updateDisplay(inputs.get('value'));
  }
};
```

This is an intrinsic because it has side effects (updating UI) beyond pure logic.

## Component Resolution

### Resolution Order

When the compiler encounters a component reference like `node x1: Xor`, it resolves in this order:

1. **Primitive kernel** - Check if it's a built-in primitive
2. **Standard library** - Check standard component library
3. **User libraries** - Check imported user libraries
4. **Current file** - Check components defined in the same file
5. **Error** - If not found, report link error

### Name Scoping

Component names are case-sensitive and follow these rules:

- **PascalCase** for component types: `FullAdder`, `RAM`, `SevenSegmentDecoder`
- Names must start with a letter
- Can contain letters, numbers, underscores
- Must be unique within a library

### Shadowing

User-defined components can shadow library components, but CANNOT shadow primitives.

```
// This works - shadows library FullAdder with custom version
circuit FullAdder {
  // Custom implementation
}

// This is an ERROR - cannot shadow primitive And
circuit And {
  // ERROR: 'And' is a primitive and cannot be redefined
}
```

### Imports (Future)

```
import std.arithmetic.FullAdder
import std.memory.RAM
import mylib.custom.SpecialAdder

// Use imported components
circuit MyCircuit {
  impl {
    node adder: FullAdder
    node mem: RAM(addr_width = 8, data_width = 16)
  }
}
```

## Library File Format

Libraries are collections of circuit definitions in IR format.

```json
{
  "name": "std.arithmetic",
  "version": "0.1.0",
  "circuits": [
    {
      "name": "HalfAdder",
      "inputs": [...],
      "outputs": [...],
      "nodes": [...],
      "connections": [...],
      "implementation": { "kind": "composite" }
    },
    {
      "name": "FullAdder",
      "inputs": [...],
      "outputs": [...],
      "nodes": [...],
      "connections": [...],
      "implementation": { "kind": "composite" }
    }
  ]
}
```

## Component Instantiation

### Basic Instantiation

```
node <instance_name>: <ComponentType>
```

Example:
```
node xor_gate: Xor
```

### Parameterized Instantiation

```
node <instance_name>: <ComponentType>(<param1> = <value1>, <param2> = <value2>)
```

Example:
```
node my_adder: RippleCarryAdder(width = 8)
node memory: RAM(addr_width = 10, data_width = 8)
```

### Port Mapping (Automatic)

Ports are automatically available on the instance:
- `my_adder.a` - input port 'a'
- `my_adder.sum` - output port 'sum'
- `memory.clk` - clock input 'clk'

## Expansion and Inlining

### When to Inline

The simulator can inline (flatten) composite components to optimize performance.

**Inline when:**
- Component is small (few nodes)
- Component is used only once
- User requests aggressive optimization

**Keep hierarchical when:**
- Component is large (many nodes)
- Component is used multiple times (share implementation)
- User wants to preserve structure for debugging
- Component has metadata/annotations worth preserving

### Expansion Process

1. **Copy nodes** from component definition
2. **Rename IDs** to avoid conflicts (e.g., `fa1.xor_1` → `circuit_fa1_xor_1`)
3. **Rewire connections** to parent circuit
4. **Update port paths** to reflect new hierarchy

### Example: Inlining HalfAdder

Before inlining:
```
circuit Example {
  impl {
    node ha: HalfAdder
    connect a -> ha.a
    connect b -> ha.b
    connect ha.sum -> sum
  }
}
```

After inlining:
```
circuit Example {
  impl {
    node ha_xor_1: Xor
    node ha_and_1: And

    connect a -> ha_xor_1.a
    connect b -> ha_xor_1.b
    connect ha_xor_1.out -> sum

    connect a -> ha_and_1.a
    connect b -> ha_and_1.b
    // ha_and_1.out -> (unused, can be eliminated)
  }
}
```

## Component Metadata

Components can have metadata for documentation, testing, and tooling.

```
circuit HalfAdder {
  metadata {
    description: "Adds two bits, producing sum and carry"
    author: "Standard Library"
    tags: ["arithmetic", "basic"]

    test "0 + 0" {
      inputs: { a: 0, b: 0 }
      outputs: { sum: 0, carry: 0 }
    }

    test "1 + 1" {
      inputs: { a: 1, b: 1 }
      outputs: { sum: 0, carry: 1 }
    }
  }

  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

  impl { ... }
}
```

## Summary Table

| Aspect | Primitive | Composite | Intrinsic |
|--------|-----------|-----------|-----------|
| Implementation | Hardcoded (TypeScript) | DSL/IR (expandable) | Special simulator logic |
| Expandable | No | Yes | No |
| Parameterizable | Limited | Yes | Limited |
| Redefinable | No | Yes (shadowing) | No |
| Performance | Fastest | Depends on expansion | Varies |
| Examples | And, Register, RAM | FullAdder, ALU | Display, Input |

## Design Rationale

### Why This Model?

1. **Primitives for performance** - Core operations are fast
2. **Composites for flexibility** - Users can build anything
3. **Intrinsics for UI** - Clean separation of concerns

### Why Not Make Everything Primitive?

- Too rigid - users can't extend
- Bloats simulator with rarely-used components
- Prevents experimentation

### Why Not Make Everything Composite?

- Performance - primitive operations are optimized
- Complexity - some things (like RAM) are easier as primitives

### Why Intrinsics?

- UI concerns (Display, Input) don't fit pure logic model
- Debugging tools (probes, counters) need simulator hooks
- Clean separation keeps core logic model pure

## Future Extensions

1. **Dynamic loading** - Load libraries at runtime
2. **Component marketplace** - Share and download components
3. **Versioning** - Semantic versioning for libraries
4. **Dependency management** - Automatic library resolution
5. **Component testing framework** - Automated test generation
6. **Formal verification** - Prove component equivalence
