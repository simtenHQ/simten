# DSL and IR Specification v0.1

**Version:** 0.1.0
**Status:** Canonical Reference

## Table of Contents

1. [Overview](#overview)
2. [Core Principles](#core-principles)
3. [DSL Syntax](#dsl-syntax)
4. [IR Data Structures](#ir-data-structures)
5. [Execution Model](#execution-model)
6. [Examples](#examples)

---

## Overview

This document specifies both the **Domain-Specific Language (DSL)** for authoring circuits and the **Intermediate Representation (IR)** used for execution.

### DSL (Domain-Specific Language)

**Purpose:** Human-readable text format for describing circuit structure and behavior

**Characteristics:**
- Declarative syntax (describe WHAT, not HOW)
- LLM-friendly (predictable patterns, forgiving of variations)
- Compiles to IR through name resolution
- Separates structure from UI concerns

### IR (Intermediate Representation)

**Purpose:** Platform-independent executable form of circuits

**Characteristics:**
- Single source of truth for circuit structure
- UI-agnostic (no positions, colors, rendering metadata)
- Serializes cleanly to/from JSON
- Deterministic execution
- Optimizable (dead code elimination, inlining, constant folding)

### Pipeline Architecture

```
DSL Text → Parse → AST → Symbol Resolution → IR → Simulation
                    ↓                          ↓
                 Names only            Executable structure
```

**Parse time:** Records component references as strings (e.g., "Xor")
**Link time:** Resolves references to actual component definitions
**Runtime:** Executes the IR using topological evaluation

---

## Core Principles

### The Fundamental Architectural Invariant

**Only primitive components contain executable behavior. Composite components are structural descriptions that expand into primitives.**

This is the most important architectural principle. See [Component Model](./component-model.md) for the complete explanation.

**Key implications for DSL and IR:**

1. **Primitive components** have no `impl` block in DSL - their behavior is hardcoded
2. **Composite components** have `impl` blocks describing structure (connections between components)
3. **IR nodes** reference components by name - primitives resolve to evaluators, composites expand
4. **Execution** always reduces to primitive operations

### Design Philosophy

**DSL:**
1. Clarity over brevity
2. Structural description (topology + behavior)
3. LLM-friendly (consistent patterns)
4. Deterministic execution
5. Clean separation (UI metadata separate from structure)
6. Hierarchical composition

**IR:**
1. Platform-independent
2. JSON-serializable
3. Execution-ready
4. Optimizable
5. Debuggable (preserves structure for introspection)

---

## DSL Syntax

### Keywords

**Language constructs** (cannot be redefined):
- `circuit` - Define a circuit/component
- `input` - Declare input port
- `output` - Declare output port
- `clock` - Declare clock input
- `node` - Instantiate a component
- `connect` - Wire ports together
- `impl` - Implementation block
- `state` - Declare stateful elements (for primitives only)

### Built-in Types

**Primitive data types:**
- `Bit` - Single binary value (0 or 1, false or true)
- `Bus[N]` - N-bit wide bus (e.g., `Bus[8]` for 8 bits)

### Circuit Definition

```dsl
circuit <name> [(<parameters>)] {
  // Port declarations
  input <name>: <type>
  output <name>: <type>
  clock <name>

  // State declarations (optional, for sequential components)
  state <name>: <type> [= <initial_value>]

  // Implementation (for composite components)
  impl {
    // Component instantiation
    node <instance_name>: <component_type>[(<arguments>)]

    // Connections
    connect <source_path> -> <target_path>
  }
}
```

### Port Declarations

```dsl
input <name>: <type>
output <name>: <type>
clock <name>
```

**Types:**
- `Bit` - Single bit
- `Bus[width]` - Multi-bit bus (width is integer)

**Examples:**
```dsl
input a: Bit
input data: Bus[8]
output sum: Bit
output result: Bus[16]
clock clk
```

### Node Instantiation

```dsl
node <id>: <ComponentType>
node <id>: <ComponentType>(<arg1> = <value1>, <arg2> = <value2>)
```

**Examples:**
```dsl
node xor1: Xor
node adder: Adder(width = 8)
node ram: RAM(addr_width = 10, data_width = 8)
```

### Connections

```dsl
connect <source> -> <target>
```

**Port paths:**
- Circuit input: `input_name`
- Circuit output: `output_name`
- Node input: `node_id.input_name`
- Node output: `node_id.output_name`

**Examples:**
```dsl
connect a -> xor1.a
connect xor1.out -> sum
connect adder.sum -> register.d
```

### Parameters (Future)

```dsl
circuit Adder(width: Int) {
  input a: Bus[width]
  input b: Bus[width]
  output sum: Bus[width]
  // ...
}
```

### Comments

```dsl
// Single-line comment

/* Multi-line
   comment */
```

### Complete Example: HalfAdder

```dsl
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

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

---

## IR Data Structures

The IR consists of TypeScript interfaces that serialize to JSON.

### 1. Circuit

Top-level container for a circuit or component definition.

```typescript
interface Circuit {
  // Identity
  id: string;           // Unique identifier
  name: string;         // Human-readable name (e.g., "FullAdder")

  // Parameterization
  parameters: Parameter[];

  // Interface
  inputs: PortDescriptor[];
  outputs: PortDescriptor[];
  clocks: ClockDescriptor[];

  // Internal structure
  state: StateBlock[];     // Internal state (for sequential components)
  nodes: Node[];           // Component instances
  connections: Connection[];

  // Implementation
  implementation: Implementation;

  // Optional metadata
  metadata?: CircuitMetadata;
}
```

### 2. Node

A component instance within a circuit.

```typescript
interface Node {
  id: string;               // Unique ID within circuit
  label?: string;           // Optional human-readable label
  componentRef: string;     // Reference to component definition (by name)
  arguments: Record<string, ArgumentValue>;  // Parameter values
  inputs: PortInstance[];
  outputs: PortInstance[];
  clocks: ClockInstance[];
}

type ArgumentValue = number | string | boolean;
```

### 3. Port Types

```typescript
interface PortDescriptor {
  name: string;
  portType: PortType;
  description?: string;
}

type PortType = BitType | BusType;

interface BitType {
  kind: 'bit';
}

interface BusType {
  kind: 'bus';
  width: number;  // Bit width (e.g., 8 for Bus[8])
}

// Helper constructors
function bitType(): BitType {
  return { kind: 'bit' };
}

function busType(width: number): BusType {
  return { kind: 'bus', width };
}
```

### 4. Port Instance

A concrete port on a node instance.

```typescript
interface PortInstance {
  id: string;         // Unique ID within circuit
  name: string;       // Port name
  portType: PortType;
  value?: BitValue | BusValue;  // Current value (populated during simulation)
}

type BitValue = boolean;
type BusValue = number;  // Represented as integer for efficiency
```

### 5. Clock Descriptor

```typescript
interface ClockDescriptor {
  name: string;
  description?: string;
}

interface ClockInstance {
  id: string;
  name: string;
  value?: boolean;  // Current clock level
}
```

### 6. State Block

For sequential components (registers, memory).

```typescript
interface StateBlock {
  id: string;          // Unique identifier
  name: string;        // State variable name
  stateType: StateType;
  initialValue?: any;  // Initial value
}

type StateType = PortType | MemoryType;

interface MemoryType {
  kind: 'memory';
  addressWidth: number;
  dataWidth: number;
}
```

### 7. Connection

Wires between ports.

```typescript
interface Connection {
  id?: string;
  from: PortPath;
  to: PortPath;
}

interface PortPath {
  nodeId: string;   // Empty string for circuit-level ports
  portName: string;
}
```

### 8. Implementation

```typescript
type Implementation = PrimitiveImplementation | CompositeImplementation;

interface PrimitiveImplementation {
  kind: 'primitive';
}

interface CompositeImplementation {
  kind: 'composite';
}
```

### 9. Parameter

```typescript
interface Parameter {
  name: string;
  paramType: ParameterType;
  defaultValue?: any;
}

type ParameterType =
  | { kind: 'integer' }
  | { kind: 'boolean' }
  | { kind: 'string' };
```

### 10. Metadata

```typescript
interface CircuitMetadata {
  description?: string;
  author?: string;
  version?: string;
  tags?: string[];

  // Component-specific metadata
  category?: string;
  icon?: string;

  // Execution hints
  outputDependency?: 'state-only' | 'input-dependent';

  // Special behavior flags
  kind?: 'sink';  // E.g., display components
  provides?: string[];  // Interfaces this component implements
  consumes?: string[];  // Interfaces this component requires
}
```

---

## Execution Model

### Combinational Evaluation

For circuits without state (no clocks, no memory):

1. **Build dependency graph** from connections
2. **Topological sort** to determine evaluation order (detects cycles)
3. **Initialize inputs** with provided values
4. **Evaluate nodes** in topological order:
   - Read input values
   - Call primitive evaluator
   - Write output values
5. **Read circuit outputs**

**Algorithm:**

```typescript
function evaluateCombinational(
  circuit: Circuit,
  inputs: Map<string, BitValue | BusValue>
): Map<string, BitValue | BusValue> {
  // 1. Build dependency graph
  const graph = buildDependencyGraph(circuit);

  // 2. Topological sort
  const order = topologicalSort(graph);
  if (!order) throw new Error('Combinational loop detected');

  // 3. Initialize port values
  const portValues = new Map(inputs);

  // 4. Evaluate nodes in order
  for (const node of order) {
    const primitive = getPrimitive(node.componentRef);
    const inputValues = readInputs(node, portValues);
    const outputValues = primitive.evaluate(inputValues);
    writeOutputs(node, outputValues, portValues);
  }

  // 5. Read circuit outputs
  return readCircuitOutputs(circuit, portValues);
}
```

### Sequential Evaluation

For circuits with state (registers, memory):

**Two-phase evaluation per cycle:**

1. **Combinational phase:**
   - Compute next state from current state + inputs
   - Compute outputs from current state + inputs

2. **State update phase** (on clock edge):
   - Detect clock transitions (rising/falling)
   - Update state for components with triggered edges
   - Swap current/next state

**Clock edge detection:**

```typescript
type ClockEdge = 'rising' | 'falling' | 'none';

function detectClockEdge(previous: boolean, current: boolean): ClockEdge {
  if (!previous && current) return 'rising';
  if (previous && !current) return 'falling';
  return 'none';
}
```

**Sequential state:**

```typescript
interface SequentialState {
  currentState: Map<string, PrimitiveState>;  // Component ID -> state
  nextState: Map<string, PrimitiveState>;
  clocks: Map<string, ClockSignal>;           // Clock ID -> signal
  cycleCount: number;
}

interface ClockSignal {
  previousValue: boolean;
  currentValue: boolean;
}

type PrimitiveState = boolean | number | Map<number, number>;  // Bit, Bus, Memory
```

### Component Resolution

When a `Node` references a component by name (via `componentRef`):

1. **Check primitives** - Look in `PRIMITIVES` array
   - If found: Use primitive evaluator

2. **Check component library** - Look in user-defined circuits
   - If found: Expand composite or instantiate

3. **Error** - Unknown component

See [Component Model](./component-model.md) for detailed resolution rules.

### Value Propagation

**Bit values:** Boolean (`true` / `false`)
**Bus values:** Number (integer, width determined by port type)

**Bus width masking:**
```typescript
function maskBusValue(value: number, width: number): number {
  const mask = (1 << width) - 1;
  return value & mask;
}
```

### Optimization Opportunities

**Dead code elimination:**
- Remove nodes with no outputs connected
- Remove connections to nowhere

**Constant folding:**
- Replace nodes with constant inputs with constant outputs
- Propagate constants through combinational logic

**Inlining:**
- Expand small composite components into parent
- Reduces node count, increases evaluation speed

**Flattening:**
- Expand all composites to primitives
- Enables maximum optimization

---

## Examples

### Example 1: Simple Gate (Primitive)

**DSL:**
```dsl
circuit And {
  input a: Bit
  input b: Bit
  output out: Bit

  // No impl - this is a primitive
}
```

**IR:**
```typescript
{
  id: 'primitive:And',
  name: 'And',
  parameters: [],
  inputs: [
    { name: 'a', portType: { kind: 'bit' } },
    { name: 'b', portType: { kind: 'bit' } }
  ],
  outputs: [
    { name: 'out', portType: { kind: 'bit' } }
  ],
  clocks: [],
  state: [],
  nodes: [],
  connections: [],
  implementation: { kind: 'primitive' },
  metadata: {
    description: 'Logical AND gate',
    category: 'logic-gates',
    icon: '&'
  }
}
```

### Example 2: HalfAdder (Composite)

**DSL:**
```dsl
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

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

**IR:**
```typescript
{
  id: 'user:HalfAdder',
  name: 'HalfAdder',
  parameters: [],
  inputs: [
    { name: 'a', portType: { kind: 'bit' } },
    { name: 'b', portType: { kind: 'bit' } }
  ],
  outputs: [
    { name: 'sum', portType: { kind: 'bit' } },
    { name: 'carry', portType: { kind: 'bit' } }
  ],
  clocks: [],
  state: [],
  nodes: [
    {
      id: 'xor1',
      componentRef: 'Xor',
      arguments: {},
      inputs: [
        { id: 'xor1.a', name: 'a', portType: { kind: 'bit' } },
        { id: 'xor1.b', name: 'b', portType: { kind: 'bit' } }
      ],
      outputs: [
        { id: 'xor1.out', name: 'out', portType: { kind: 'bit' } }
      ],
      clocks: []
    },
    {
      id: 'and1',
      componentRef: 'And',
      arguments: {},
      inputs: [
        { id: 'and1.a', name: 'a', portType: { kind: 'bit' } },
        { id: 'and1.b', name: 'b', portType: { kind: 'bit' } }
      ],
      outputs: [
        { id: 'and1.out', name: 'out', portType: { kind: 'bit' } }
      ],
      clocks: []
    }
  ],
  connections: [
    { from: { nodeId: '', portName: 'a' }, to: { nodeId: 'xor1', portName: 'a' } },
    { from: { nodeId: '', portName: 'b' }, to: { nodeId: 'xor1', portName: 'b' } },
    { from: { nodeId: 'xor1', portName: 'out' }, to: { nodeId: '', portName: 'sum' } },
    { from: { nodeId: '', portName: 'a' }, to: { nodeId: 'and1', portName: 'a' } },
    { from: { nodeId: '', portName: 'b' }, to: { nodeId: 'and1', portName: 'b' } },
    { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: '', portName: 'carry' } }
  ],
  implementation: { kind: 'composite' }
}
```

### Example 3: Register (Sequential Primitive)

**DSL:**
```dsl
circuit Register {
  input d: Bus[8]
  input we: Bit
  output q: Bus[8]
  clock clk

  state value: Bus[8] = 0

  // No impl - primitive with sequential behavior
}
```

**IR:**
```typescript
{
  id: 'primitive:Register',
  name: 'Register',
  parameters: [],
  inputs: [
    { name: 'd', portType: { kind: 'bus', width: 8 } },
    { name: 'we', portType: { kind: 'bit' } }
  ],
  outputs: [
    { name: 'q', portType: { kind: 'bus', width: 8 } }
  ],
  clocks: [
    { name: 'clk' }
  ],
  state: [
    {
      id: 'reg-state',
      name: 'value',
      stateType: { kind: 'bus', width: 8 },
      initialValue: 0
    }
  ],
  nodes: [],
  connections: [],
  implementation: { kind: 'primitive' },
  metadata: {
    description: '8-bit Register - stores data when write enable is high',
    category: 'sequential',
    icon: 'REG',
    outputDependency: 'state-only'
  }
}
```

### Example 4: Counter (Sequential Composite)

**DSL:**
```dsl
circuit Counter {
  input clk: Bit
  output count: Bus[8]

  impl {
    node reg: Register
    node inc: Incrementer

    connect clk -> reg.clk
    connect reg.q -> inc.in
    connect inc.out -> reg.d
    connect reg.q -> count
  }
}
```

---

## Type System

### Value Types

**Bit:**
- Representation: `boolean`
- Values: `true` (1) or `false` (0)

**Bus:**
- Representation: `number` (unsigned integer)
- Width: Specified in port type (e.g., `Bus[8]`)
- Range: 0 to 2^width - 1

### Type Compatibility

**Port connections must match types:**
- Bit → Bit ✅
- Bus[8] → Bus[8] ✅
- Bit → Bus[1] ❌ (requires explicit conversion)
- Bus[8] → Bus[16] ❌ (requires explicit conversion or padding)

**Type conversions (via utility components):**
- `Splitter` - Bus → multiple Buses or Bits
- `BitSlice` - Extract specific bits from Bus

---

## JSON Serialization

All IR structures serialize directly to JSON:

```json
{
  "id": "user:HalfAdder",
  "name": "HalfAdder",
  "parameters": [],
  "inputs": [
    { "name": "a", "portType": { "kind": "bit" } },
    { "name": "b", "portType": { "kind": "bit" } }
  ],
  "outputs": [
    { "name": "sum", "portType": { "kind": "bit" } },
    { "name": "carry", "portType": { "kind": "bit" } }
  ],
  "clocks": [],
  "state": [],
  "nodes": [
    {
      "id": "xor1",
      "componentRef": "Xor",
      "arguments": {},
      "inputs": [],
      "outputs": [],
      "clocks": []
    }
  ],
  "connections": [
    { "from": { "nodeId": "", "portName": "a" }, "to": { "nodeId": "xor1", "portName": "a" } }
  ],
  "implementation": { "kind": "composite" }
}
```

---

## Related Documents

- **[Component Model](./component-model.md)** - Primitive vs composite architecture
- **[Getting Started](../getting-started.md)** - DSL usage guide
- **[Primitive Quick Reference](../REFERENCE/primitive-quick-reference.md)** - Available primitives
- **[How to Add a Primitive](../how-to-add-primitive.md)** - Extending the system

---

## Future Extensions

### Planned Features

1. **Parameterized circuits:**
   ```dsl
   circuit Adder(width: Int) {
     input a: Bus[width]
     input b: Bus[width]
     output sum: Bus[width]
   }
   ```

2. **Array instantiation:**
   ```dsl
   node registers[8]: Register
   ```

3. **Conditional generate:**
   ```dsl
   if (WIDTH > 8) {
     node wide_adder: Adder(width = WIDTH)
   }
   ```

4. **Library imports:**
   ```dsl
   import std.arithmetic.FullAdder
   import mylib.custom.SpecialAdder
   ```

5. **Inline tests:**
   ```dsl
   circuit HalfAdder {
     // ...

     test "0 + 0 = 0" {
       inputs: { a: 0, b: 0 }
       outputs: { sum: 0, carry: 0 }
     }
   }
   ```

### Compatibility

The IR version follows semantic versioning:
- **Major version** (0.x) - Breaking changes to IR structure
- **Minor version** (x.1) - Backward-compatible additions
- **Patch version** - Bug fixes and clarifications

Current version: **0.1.0**
