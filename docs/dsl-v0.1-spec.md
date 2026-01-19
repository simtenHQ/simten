# DSL v0.1 Specification

## Overview

This document defines the Turing Incomplete Domain-Specific Language (DSL) v0.1 for describing digital circuits that can be simulated in the browser.

**Core Principle:** The DSL describes WHAT the circuit IS (structure and behavior), not HOW to render it (UI concerns).

## Core Principles

**CRITICAL ARCHITECTURAL INVARIANT:**

**Only primitive components contain executable behavior. Composite components are structural descriptions that expand into primitives.**

This means:
- **Primitive components** (And, Or, Not, Register, etc.) DO have inherent behavior - they are the atomic building blocks with hardcoded logic
- **Composite components** have NO inherent behavior - they are purely structural descriptions of how to connect other components
- Composite components are ALWAYS expandable to primitives
- No "magic" behavior exists at the composite component level
- All execution reduces to primitive operations
- Composites are purely structural containers
- Behavior is an emergent property of the primitive composition

**Why this matters:**
- Ensures deterministic, predictable execution
- Enables complete introspection and debugging
- Allows arbitrary optimization (inline, flatten, reorder)
- Prevents hidden state or side effects in composites
- Makes the system truly compositional

## Design Philosophy

1. **Clarity over brevity** - Code should be immediately understandable
2. **Structural description** - Describe the circuit's topology and behavior
3. **LLM-friendly** - Predictable syntax, consistent patterns, forgiving of variations
4. **Deterministic execution** - No ambiguity in evaluation order
5. **Clean separation** - UI metadata is separate from structural/behavioral specification
6. **Hierarchical composition** - Support reusable components with clear parameterization
7. **IR-first thinking** - DSL lowers cleanly to a simple, efficient IR

## Pipeline Architecture

```
DSL Text → Parse → AST → Symbol Resolution → IR → Simulation
                    ↓                          ↓
                 Names only            Executable structure
```

**Parse time:** Records component references as strings (e.g., "Xor")
**Link time:** Resolves references to actual component definitions
**Runtime:** Executes the IR using topological evaluation

## Keywords and Built-ins

### DSL Keywords (Language Constructs)
These are part of the DSL grammar and cannot be redefined:

- `circuit` - Defines a circuit/component
- `input` - Declares an input port
- `output` - Declares an output port
- `clock` - Declares a clock input
- `node` - Instantiates a component
- `connect` - Wires ports together
- `state` - Declares stateful elements (registers, memory)

### Built-in Types
These are primitive data types recognized by the language:

- `Bit` - Single binary value (0 or 1, false or true)
- `Bus[N]` - N-bit wide bus (e.g., `Bus[8]` for 8 bits)
- `Word[N]` - Alias for Bus[N], used for clarity in some contexts

### NOT Built-ins (Library Components)
These are component definitions in the standard library, resolved by name:

- Logic gates: `And`, `Or`, `Not`, `Nand`, `Nor`, `Xor`, `Xnor`, `Buffer`
- Arithmetic: `Adder`, `HalfAdder`, `FullAdder`, `ALU`
- Memory: `Register`, `RAM`, `ROM`
- Multiplexing: `Mux`, `Demux`
- Display: `Display`, `SevenSegment` (UI widgets, not semantic primitives)

## Syntax Specification

### Circuit Definition

```
circuit <name> [(<parameters>)] {
  // Port declarations
  input <name>: <type>
  output <name>: <type>
  clock <name>

  // State declarations (optional)
  state <name>: <type> [= <initial_value>]

  // Component instantiation
  node <instance_name>: <component_type>[(<arguments>)]

  // Connections
  connect <source_path> -> <target_path>

  // Nested implementation (for composite components)
  impl {
    // Implementation details
  }
}
```

### Examples

#### Primitive Component (No Implementation)

Primitive components are provided by the simulator kernel. They have no DSL implementation.

```
circuit And {
  input a: Bit
  input b: Bit
  output out: Bit

  // No impl block - this is a primitive provided by the simulator
}
```

#### Simple Combinational Component

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

#### Component Using Another Component

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

    // First half adder: a + b
    connect a -> ha1.a
    connect b -> ha1.b

    // Second half adder: (a + b) + cin
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum

    // Carry out: carry from either half adder
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}
```

#### Parameterized Component

```
circuit Adder(width: Int) {
  input a: Bus[width]
  input b: Bus[width]
  output sum: Bus[width]
  output cout: Bit

  impl {
    // Implementation would instantiate width full adders
    // and chain them together
  }
}

// Usage:
circuit Example {
  input x: Bus[8]
  input y: Bus[8]
  output result: Bus[8]

  impl {
    node adder: Adder(width = 8)

    connect x -> adder.a
    connect y -> adder.b
    connect adder.sum -> result
  }
}
```

#### Stateful Component (Register)

```
circuit Register {
  input d: Bit
  input clk: Bit
  output q: Bit

  state value: Bit = 0

  impl {
    // On clock rising edge, capture input
    on clk rising {
      value = d
    }

    // Output always reflects stored value
    q = value
  }
}
```

#### Multi-bit Register

```
circuit Register8 {
  input d: Bus[8]
  clock clk
  output q: Bus[8]

  state value: Bus[8] = 0x00

  impl {
    on clk rising {
      value = d
    }
    q = value
  }
}
```

#### RAM Component

```
circuit RAM(addr_width: Int, data_width: Int) {
  input addr: Bus[addr_width]
  input data_in: Bus[data_width]
  input write_enable: Bit
  clock clk
  output data_out: Bus[data_width]

  state memory: Array[2^addr_width, Bus[data_width]]

  impl {
    // Read is combinational
    data_out = memory[addr]

    // Write is clocked
    on clk rising {
      if write_enable {
        memory[addr] = data_in
      }
    }
  }
}
```

## Port References

Ports are referenced using dot notation:

```
<node_instance>.<port_name>
```

Examples:
- `ha1.sum` - the 'sum' output of node 'ha1'
- `adder.a` - the 'a' input of node 'adder'
- `reg.clk` - the 'clk' clock input of node 'reg'

For circuit-level ports, use the port name directly:
- `sum` - the circuit's own 'sum' output port
- `a` - the circuit's own 'a' input port

## Connection Semantics

Connections describe data flow from source to target:

```
connect <source> -> <target>
```

Rules:
1. Source must be an output port or circuit input
2. Target must be an input port or circuit output
3. Types must be compatible (same bit width)
4. Multiple readers from one source are allowed (fan-out)
5. Multiple writers to one target are forbidden (creates conflict)

## State and Clocking

### State Declaration

```
state <name>: <type> [= <initial_value>]
```

State persists between clock cycles. Initial value is used at simulation start.

### Clock Sensitivity

```
on <clock_signal> rising {
  // Statements executed on rising edge
}

on <clock_signal> falling {
  // Statements executed on falling edge
}
```

All state updates must be inside clock sensitivity blocks.

### Combinational vs Sequential

- **Combinational:** Output depends only on current inputs (no clock, no state)
- **Sequential:** Output depends on inputs AND internal state (requires clock)

Example:

```
circuit Counter {
  clock clk
  output count: Bus[8]

  state value: Bus[8] = 0

  impl {
    // Combinational: output always shows current state
    count = value

    // Sequential: state updates on clock edge
    on clk rising {
      value = value + 1
    }
  }
}
```

## Type System

### Bit
Single binary value. Represented as boolean (true/false) or integer (1/0).

### Bus[N]
N-bit wide parallel signal. Represented as N-element array of bits or as integer.

Width must be a compile-time constant (literal or parameter).

### Type Compatibility

- `Bit` connects to `Bit`
- `Bus[N]` connects to `Bus[N]` (same width)
- Bit can be promoted to `Bus[1]` implicitly
- Explicit width conversion requires cast or adapter component

## Parameterization

Components can be parameterized by:

1. **Integer constants** - widths, sizes, counts
2. **Type parameters** (future) - generic components

Parameters are provided at instantiation:

```
node <instance>: <Component>(<param1> = <value1>, <param2> = <value2>)
```

Parameters are compile-time constants, not runtime values.

## Comments

```
// Single-line comment

/*
 * Multi-line comment
 */
```

## Name Resolution and Linking

### Resolution Order

1. Built-in types (`Bit`, `Bus`)
2. Primitive components (simulator kernel: `And`, `Or`, `Register`, etc.)
3. Standard library components
4. User-defined components in current file
5. Imported components (future)

### Link Errors

If a component reference cannot be resolved:
```
Error: Cannot resolve component 'Xor'
  at circuit HalfAdder, line 8

  Suggestions:
  - Did you mean 'XOR'?
  - Check spelling and case sensitivity
  - Ensure component is defined or imported
```

This is a link-time error, not a parse error. The parser accepts any valid identifier.

## LLM Generation Guidelines

When generating DSL code, LLMs should:

1. **Use consistent naming:**
   - Component types: `PascalCase` (e.g., `FullAdder`)
   - Instance names: `snake_case` or `camelCase` (e.g., `half_adder_1` or `halfAdder1`)
   - Port names: `snake_case` (e.g., `data_in`, `write_enable`)

2. **Be explicit:**
   - Always specify port types
   - Always specify connection directions with `->`
   - Use full port paths (`node.port`)

3. **Structure clearly:**
   - Declare all ports first
   - Then declare state
   - Then instantiate nodes
   - Then make connections
   - Impl block last

4. **Handle parameters:**
   - Always use named parameters: `Adder(width = 8)`
   - Never positional parameters (for clarity)

5. **Comment generously:**
   - Explain what each component does
   - Clarify complex connection patterns
   - Note any non-obvious behavior

## Error Handling

### Parse Errors
Syntax violations, malformed constructs. Provide line number and suggestion.

### Link Errors
Undefined component references. Provide name, location, and suggestions.

### Type Errors
Incompatible connections. Show expected vs actual types.

### Semantic Errors
- Multiple drivers on one input
- Combinational loops
- Unconnected required ports

## Future Extensions

1. **Arrays and iteration:** `for i in 0..width { ... }`
2. **Conditional generation:** `if width > 8 { ... }`
3. **Import/module system:** `import std.arithmetic.Adder`
4. **Assertions:** `assert sum == (a ^ b ^ cin)`
5. **Formal properties:** `property no_overflow { ... }`
6. **Multi-clock domains:** `clock clk_fast(100MHz), clk_slow(10MHz)`

## Comparison with HDLs

| Feature | Turing Incomplete DSL | Verilog/VHDL |
|---------|----------------------|--------------|
| Execution | Browser simulation | Hardware synthesis |
| Timing | Discrete clock ticks | Real-time timing |
| Complexity | Thousands of nodes | Millions of gates |
| Learning curve | Gentle | Steep |
| Purpose | Education | Production hardware |

The DSL is not intended to replace HDLs. It is a teaching tool for understanding digital logic.
