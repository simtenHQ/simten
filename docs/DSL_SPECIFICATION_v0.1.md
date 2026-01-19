# DSL Specification v0.1

## Table of Contents
1. [Philosophy and Principles](#philosophy-and-principles)
2. [DSL Syntax](#dsl-syntax)
3. [Component Library Model](#component-library-model)
4. [Linking and Resolution](#linking-and-resolution)
5. [Examples](#examples)

---

## Philosophy and Principles

### What the DSL Describes
The DSL describes **structural and behavioral semantics** of digital circuits:
- What components exist
- How they connect
- What ports they expose
- What state they maintain
- When state updates occur

### What the DSL Does NOT Describe
- How components render visually (position, color, size)
- UI interaction patterns (switches, LEDs, probes)
- Performance optimization hints
- Transistor-level physics

### Core Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                         DSL Text                            │
│  (Human/LLM authored, describes structure and behavior)     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   AST Parser   │
              │ (name refs only)│
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │ Symbol Resolver │
              │  (link phase)  │
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │   IR Generator │
              │  (flatten/lower)│
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │   Simulator    │
              │ (execute IR)   │
              └────────────────┘
```

**Key Insight:** UI concerns are a **projection** of the IR, not part of it.

```
Input widget (UI) ──projects to──> Input port (IR semantic)
LED widget (UI)   ──projects to──> Output port (IR semantic)
```

---

## DSL Syntax

### Keywords (Meta-Constructs Only)

These are the **only** reserved words in the DSL:

- `circuit` - Top-level circuit definition
- `component` - Component definition or instance
- `input` - Input port declaration
- `output` - Output port declaration
- `clock` - Clock signal declaration
- `connect` - Wire connection
- `on` - Clock edge specification
- `reg` - Register state
- `mem` - Memory state

### Built-in Types

- `Bit` - Single-bit value (0 or 1)
- `Bus[N]` - N-bit bus where N is a positive integer

### Component Definition Syntax

#### Primitive Components

Primitive components are **kernel nodes** provided by the simulator runtime. They have built-in evaluation semantics.

```
component And {
  inputs {
    a: Bit
    b: Bit
  }
  outputs {
    out: Bit
  }
  impl: primitive
}
```

The `impl: primitive` marker indicates this component's behavior is provided by the simulator kernel.

#### Composite Components

Composite components are built from other components. They define structure and connections.

```
component HalfAdder {
  inputs {
    a: Bit
    b: Bit
  }
  outputs {
    sum: Bit
    carry: Bit
  }

  nodes {
    xor1: Xor
    and1: And
  }

  connections {
    this.a -> xor1.a
    this.b -> xor1.b
    this.a -> and1.a
    this.b -> and1.b
    xor1.out -> this.sum
    and1.out -> this.carry
  }
}
```

**Key Principles:**
1. `nodes` declares component instances (symbol references, not keywords)
2. `connections` describes wiring (source port -> target port)
3. `this.portName` refers to the component's own ports
4. Component types (Xor, And) are resolved during the link phase

#### Parameterized Components

Components can be parameterized for reusability.

```
component Adder {
  params {
    width: Int = 8
  }

  inputs {
    a: Bus[width]
    b: Bus[width]
    cin: Bit
  }
  outputs {
    sum: Bus[width]
    cout: Bit
  }

  nodes {
    adders: FullAdder[width]
  }

  connections {
    // Per-bit connections with carry chain
    for i in 0..width {
      a[i] -> adders[i].a
      b[i] -> adders[i].b
      if i == 0 {
        cin -> adders[i].cin
      } else {
        adders[i-1].cout -> adders[i].cin
      }
      adders[i].sum -> sum[i]
    }
    adders[width-1].cout -> cout
  }
}
```

**Parameterization Features:**
- `params` block declares parameters with optional defaults
- Parameters can be used in type expressions (`Bus[width]`)
- Array instantiation (`FullAdder[width]`)
- Iteration constructs (`for i in 0..width`)

#### Stateful Components (Registers)

Components can maintain state that updates on clock edges.

```
component DFlipFlop {
  inputs {
    d: Bit
    clk: Bit
  }
  outputs {
    q: Bit
    qbar: Bit
  }

  state {
    reg q_internal: Bit = 0
  }

  on posedge(clk) {
    q_internal <- d
  }

  connections {
    q_internal -> this.q
    // qbar is computed combinationally
  }

  nodes {
    inv: Not
  }

  connections {
    q_internal -> inv.in
    inv.out -> this.qbar
  }
}
```

**State Features:**
- `state` block declares registers with initial values
- `on posedge(clk)` specifies when state updates
- `<-` is the assignment operator for state updates
- State reads are combinational, writes are clocked

#### Memory Components

```
component RAM {
  params {
    addr_width: Int = 8
    data_width: Int = 8
  }

  inputs {
    addr: Bus[addr_width]
    data_in: Bus[data_width]
    write_enable: Bit
    clk: Bit
  }
  outputs {
    data_out: Bus[data_width]
  }

  state {
    mem storage: Bus[data_width][2^addr_width] = 0
  }

  on posedge(clk) {
    if write_enable {
      storage[addr] <- data_in
    }
  }

  // Combinational read
  assign data_out = storage[addr]
}
```

**Memory Features:**
- Multi-dimensional state (`Bus[data_width][2^addr_width]`)
- Conditional state updates (`if write_enable`)
- Combinational assignments (`assign`)

---

## Component Library Model

### Three Types of Components

#### 1. Primitive Kernel Nodes
Provided by the simulator runtime. Small, fixed set.

**Examples:**
- `And`, `Or`, `Not`, `Xor` - Basic logic
- `Mux`, `Demux` - Multiplexing
- `Register` - Single-bit register
- `Constant` - Constant value source

**Implementation:** Hard-coded evaluation functions in the simulator.

#### 2. Lowered Composites
Defined in DSL, expanded during compilation.

**Examples:**
- `HalfAdder`, `FullAdder` - Arithmetic
- `Decoder`, `Encoder` - Logic utilities
- `Counter`, `ShiftRegister` - Sequential circuits
- `ALU`, `RegisterFile` - Complex subsystems

**Implementation:** DSL component definitions, fully expandable to primitives.

#### 3. Foreign/Intrinsic Nodes
Special nodes for I/O and debugging.

**Examples:**
- `Input` - External input source (UI projects as switch/button)
- `Output` - External output sink (UI projects as LED/display)
- `Probe` - Debug observation point
- `Clock` - Clock signal generator

**Implementation:** Special handling by simulator and UI layer.

### Standard Library Organization

```
std/
  primitives/
    logic.dsl       # And, Or, Not, Xor, etc.
    mux.dsl         # Mux, Demux
    register.dsl    # Register, RegisterFile
    memory.dsl      # RAM, ROM

  combinational/
    adder.dsl       # HalfAdder, FullAdder, Adder
    comparator.dsl  # Equal, LessThan, etc.
    decoder.dsl     # Decoder, Encoder, PriorityEncoder
    alu.dsl         # ALU with parameterized operations

  sequential/
    flipflop.dsl    # SR, D, JK, T flip-flops
    counter.dsl     # Counter, UpDownCounter
    shift.dsl       # ShiftRegister, LFSR

  io/
    interface.dsl   # Input, Output, Probe, Clock
```

### Component Resolution Process

```
1. Parse DSL -> AST
   - Component references are just names (strings)
   - Example: node xor1: Xor

2. Symbol Resolution (Linking)
   - Look up "Xor" in component library
   - Check if it's a primitive, composite, or foreign
   - Verify port compatibility
   - Error if undefined or mismatched

3. IR Generation
   - Primitives: Create IR nodes directly
   - Composites: Recursively expand until primitives
   - Foreign: Create special IR node types

4. Simulation
   - Execute IR with kernel evaluation functions
```

**Critical Point:** At parse time, `Xor` is just a name. The parser doesn't know if it's valid. That's the linker's job.

---

## Linking and Resolution

### Link-Time vs Parse-Time Errors

#### Parse-Time Errors (Syntax)
- Malformed component definitions
- Invalid connection syntax
- Type syntax errors
- Missing required blocks

#### Link-Time Errors (Semantics)
- Undefined component references
- Port count mismatches
- Type mismatches (Bit vs Bus)
- Circular dependencies (for type checking)
- Missing required parameters

### Resolution Algorithm

```typescript
function resolveComponent(
  name: string,
  params: Map<string, Value>,
  library: ComponentLibrary
): ResolvedComponent {
  // 1. Look up component definition
  const def = library.lookup(name);
  if (!def) {
    throw new LinkError(`Undefined component: ${name}`);
  }

  // 2. Validate parameters
  const resolvedParams = validateParams(def.params, params);

  // 3. Recursively resolve dependencies
  if (def.type === 'composite') {
    const resolvedNodes = def.nodes.map(node =>
      resolveComponent(node.type, node.params, library)
    );
    return { def, resolvedParams, resolvedNodes };
  }

  // 4. For primitives, return immediately
  return { def, resolvedParams };
}
```

### Primitive Kernel Registry

The simulator maintains a registry of primitive evaluators:

```typescript
type PrimitiveEvaluator = (inputs: BitVector[]) => BitVector[];

const PRIMITIVE_REGISTRY: Map<string, PrimitiveSpec> = new Map([
  ['And', {
    inputs: [{ name: 'a', type: 'Bit' }, { name: 'b', type: 'Bit' }],
    outputs: [{ name: 'out', type: 'Bit' }],
    evaluate: (inputs) => [inputs[0] & inputs[1]]
  }],
  ['Or', {
    inputs: [{ name: 'a', type: 'Bit' }, { name: 'b', type: 'Bit' }],
    outputs: [{ name: 'out', type: 'Bit' }],
    evaluate: (inputs) => [inputs[0] | inputs[1]]
  }],
  // ... more primitives
]);
```

**At link time:** Component reference "And" is validated against this registry.

---

## Examples

### Example 1: Half Adder

```
component HalfAdder {
  inputs {
    a: Bit
    b: Bit
  }
  outputs {
    sum: Bit
    carry: Bit
  }

  nodes {
    xor1: Xor
    and1: And
  }

  connections {
    this.a -> xor1.a
    this.b -> xor1.b
    this.a -> and1.a
    this.b -> and1.b
    xor1.out -> this.sum
    and1.out -> this.carry
  }
}
```

**Explanation:**
- Uses two library components: `Xor` and `And`
- `this.a` refers to HalfAdder's input port `a`
- `xor1.a` refers to the `a` input port of the `xor1` instance

### Example 2: Full Adder Using Half Adders

```
component FullAdder {
  inputs {
    a: Bit
    b: Bit
    cin: Bit
  }
  outputs {
    sum: Bit
    cout: Bit
  }

  nodes {
    ha1: HalfAdder
    ha2: HalfAdder
    or1: Or
  }

  connections {
    // First half adder: a + b
    this.a -> ha1.a
    this.b -> ha1.b

    // Second half adder: (a+b) + cin
    ha1.sum -> ha2.a
    this.cin -> ha2.b

    // Final sum
    ha2.sum -> this.sum

    // Carry out: (a AND b) OR ((a XOR b) AND cin)
    ha1.carry -> or1.a
    ha2.carry -> or1.b
    or1.out -> this.cout
  }
}
```

**Demonstration of Composition:**
- `HalfAdder` instances are resolved recursively
- Each `HalfAdder` expands to `Xor` + `And`
- Final IR has 4 primitives total: 2 Xor, 2 And, 1 Or

### Example 3: 4-Bit Ripple Carry Adder

```
component RippleCarryAdder {
  params {
    width: Int = 4
  }

  inputs {
    a: Bus[width]
    b: Bus[width]
    cin: Bit
  }
  outputs {
    sum: Bus[width]
    cout: Bit
  }

  nodes {
    adders: FullAdder[width]
  }

  connections {
    for i in 0..width {
      a[i] -> adders[i].a
      b[i] -> adders[i].b

      if i == 0 {
        cin -> adders[i].cin
      } else {
        adders[i-1].cout -> adders[i].cin
      }

      adders[i].sum -> sum[i]
    }

    adders[width-1].cout -> cout
  }
}
```

**Parameterization:**
- `width` parameter controls the number of bits
- Array instantiation: `FullAdder[width]`
- Iteration: `for i in 0..width`
- Conditional: `if i == 0`

### Example 4: D Flip-Flop with Clock

```
component DFlipFlop {
  inputs {
    d: Bit
    clk: Bit
  }
  outputs {
    q: Bit
    qbar: Bit
  }

  state {
    reg q_reg: Bit = 0
  }

  on posedge(clk) {
    q_reg <- d
  }

  nodes {
    inv: Not
  }

  connections {
    q_reg -> this.q
    q_reg -> inv.in
    inv.out -> this.qbar
  }
}
```

**State and Clocking:**
- `state` block declares a register
- `on posedge(clk)` specifies update timing
- `<-` is state assignment (happens on clock edge)
- Combinational reads: `q_reg -> this.q`

### Example 5: Circuit Using I/O (UI Projection)

```
circuit XorGateTest {
  nodes {
    in_a: Input(label: "Input A")
    in_b: Input(label: "Input B")
    xor1: Xor
    out: Output(label: "Result")
  }

  connections {
    in_a.out -> xor1.a
    in_b.out -> xor1.b
    xor1.out -> out.in
  }
}
```

**I/O Projection:**
- `Input` is a foreign component (provides external values)
- `Output` is a foreign component (observes values)
- **UI Layer** decides how to render these:
  - Input might be a switch, button, or hex keypad
  - Output might be an LED, 7-segment display, or hex monitor
- **IR Layer** only knows: Input has one output port, Output has one input port

### Example 6: Complete 4-Bit Counter

```
component Counter4Bit {
  inputs {
    clk: Bit
    reset: Bit
    enable: Bit
  }
  outputs {
    count: Bus[4]
    overflow: Bit
  }

  state {
    reg counter: Bus[4] = 0
  }

  on posedge(clk) {
    if reset {
      counter <- 0
    } else if enable {
      counter <- counter + 1
    }
  }

  nodes {
    eq: Equal(width: 4)
    const_max: Constant(value: 15, width: 4)
  }

  connections {
    counter -> this.count
    counter -> eq.a
    const_max.out -> eq.b
    eq.out -> this.overflow
  }
}
```

**Advanced Features:**
- Multi-bit register state
- Conditional state updates
- Arithmetic in state update (`counter + 1`)
- Parameterized component instantiation (`Equal(width: 4)`)
- Constant values

---

## LLM-Friendly Design Rationale

### Predictable Structure

Every component follows the same template:
```
component Name {
  [params { ... }]
  [inputs { ... }]
  [outputs { ... }]
  [state { ... }]
  [nodes { ... }]
  [connections { ... }]
  [on edge { ... }]
}
```

LLMs can reliably generate this structure.

### Consistent Naming

- Port references: `component.port`
- Self-references: `this.port`
- Array indexing: `bus[i]`
- Parameters: `width`, `addr_width`, `data_width`

### Forgiving of Variations

The DSL parser is lenient:
- Whitespace insensitive
- Block order doesn't matter (except connections after nodes)
- Trailing commas allowed
- Multiple connection styles supported

### Self-Documenting

- Explicit types: `a: Bit`, `data: Bus[8]`
- Named ports: `xor1.a -> and1.in0`
- Labels: `Input(label: "Clock")`
- Clear directionality: `->` operator

### Clear Error Recovery

Link-time errors provide actionable messages:
```
Error: Undefined component 'Xorr' at line 42
  Did you mean: Xor, Or, Nor?

Error: Port count mismatch for 'And' at line 15
  Expected 2 inputs, got 3
  Component 'And' signature: inputs { a: Bit, b: Bit }
```

---

## Future Extensions (v0.2+)

### Multi-Clock Domains
```
component DualClock {
  inputs {
    clk_fast: Bit
    clk_slow: Bit
    data: Bit
  }

  clock_domains {
    fast: clk_fast
    slow: clk_slow
  }

  state {
    reg @fast fast_reg: Bit
    reg @slow slow_reg: Bit
  }
}
```

### Hierarchical Naming
```
circuit CPU {
  nodes {
    alu: ALU
    regs: RegisterFile
  }

  debug {
    probe "ALU Output" at alu.result
    probe "PC Value" at regs.pc
  }
}
```

### Assertions and Formal Verification
```
component Adder {
  inputs {
    a: Bus[8]
    b: Bus[8]
  }
  outputs {
    sum: Bus[8]
  }

  assert {
    // Overflow detection
    (a[7] == b[7] && sum[7] != a[7]) => overflow
  }
}
```

### Performance Annotations
```
component LargeRAM {
  state {
    mem @lazy storage: Bus[32][65536]
  }

  optimize {
    cache_recent: 16
    prefetch: true
  }
}
```

---

## Summary

This DSL achieves the core design goals:

1. **Clarity over brevity**: Explicit types, named connections, clear structure
2. **Structural description**: Describes WHAT, not HOW to render
3. **LLM-friendly**: Predictable syntax, forgiving of variations
4. **Deterministic execution**: Clock edges, evaluation order well-defined
5. **Clean separation**: UI widgets are projections of IR primitives
6. **Hierarchical composition**: Components use components, full reusability
7. **IR-first thinking**: DSL lowers cleanly to formal IR (see IR spec)

**Most importantly:** Components like `Xor`, `And`, `Register` are **library entries**, not keywords. The DSL performs name resolution, the linker validates semantics, and the simulator provides primitive evaluation.
