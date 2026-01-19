# Intermediate Representation (IR) v0.1 Specification

## Overview

The IR is the executable form of a circuit. It is:
- **The single source of truth** for circuit structure and behavior
- **Platform-independent** - can be serialized to JSON, executed in browser, saved to disk
- **UI-agnostic** - contains no rendering information (positions, colors, etc.)
- **Deterministic** - execution order and results are fully specified
- **Optimizable** - supports dead code elimination, constant folding, inlining

## Design Principles

1. **IR ↔ JSON** - IR serializes cleanly to/from JSON
2. **DSL → IR** - DSL compiles to IR through name resolution
3. **UI ↔ IR** - UI reads IR and projects it to visual representation
4. **Execution operates on IR** - Simulator consumes IR directly

## Core Data Structures

### 1. Circuit

The top-level container representing a complete circuit or component definition.

```typescript
interface Circuit {
  // Unique identifier for this circuit
  id: string;

  // Human-readable name (e.g., "FullAdder", "8BitALU")
  name: string;

  // Parameters this circuit accepts (if any)
  parameters: Parameter[];

  // Input ports exposed by this circuit
  inputs: PortDescriptor[];

  // Output ports exposed by this circuit
  outputs: PortDescriptor[];

  // Clock inputs (if any)
  clocks: ClockDescriptor[];

  // Internal state (registers, memory)
  state: StateBlock[];

  // Component instances within this circuit
  nodes: Node[];

  // Connections between ports
  connections: Connection[];

  // How this circuit is implemented
  implementation: Implementation;

  // Metadata for debugging/tooling
  metadata?: CircuitMetadata;
}
```

### 2. Node

A component instance within a circuit.

```typescript
interface Node {
  // Unique ID within the circuit
  id: string;

  // Human-readable label (optional)
  label?: string;

  // Reference to component definition (by name)
  componentRef: string;

  // Argument values for parameterized components
  arguments: Record<string, ArgumentValue>;

  // Input ports on this node
  inputs: PortInstance[];

  // Output ports on this node
  outputs: PortInstance[];

  // Clock inputs on this node (if any)
  clocks: ClockInstance[];
}

type ArgumentValue = number | string | boolean;
```

### 3. Port Descriptors

Describes the type and direction of a port.

```typescript
interface PortDescriptor {
  // Unique name within component (e.g., "a", "sum", "data_in")
  name: string;

  // Port data type
  portType: PortType;

  // Human-readable description (optional)
  description?: string;
}

type PortType = BitType | BusType;

interface BitType {
  kind: 'bit';
}

interface BusType {
  kind: 'bus';
  width: number; // Bit width (e.g., 8 for Bus[8])
}
```

### 4. Port Instance

A concrete port on a node instance.

```typescript
interface PortInstance {
  // Unique ID within the circuit
  id: string;

  // Port name (matches PortDescriptor.name)
  name: string;

  // Port type
  portType: PortType;

  // Current value (populated during simulation)
  value?: BitValue | BusValue;
}

type BitValue = boolean;
type BusValue = number; // Represented as integer for efficiency
```

### 5. Clock Descriptor and Instance

```typescript
interface ClockDescriptor {
  // Clock signal name
  name: string;

  // Description (optional)
  description?: string;
}

interface ClockInstance {
  id: string;
  name: string;
  // Current clock state (set by simulation)
  state?: ClockState;
}

interface ClockState {
  value: boolean; // Current level (high/low)
  edge: 'rising' | 'falling' | 'none'; // Edge detected this cycle
}
```

### 6. Connection

Represents a wire connecting two ports.

```typescript
interface Connection {
  // Unique connection ID
  id: string;

  // Source (output or circuit input)
  source: PortPath;

  // Target (input or circuit output)
  target: PortPath;

  // Type verification (must match on both ends)
  portType: PortType;
}

interface PortPath {
  // Node ID (empty string for circuit-level ports)
  nodeId: string;

  // Port name
  portName: string;
}
```

### 7. State Blocks

Represents stateful elements (registers, memory).

```typescript
interface StateBlock {
  // Unique identifier
  id: string;

  // Variable name
  name: string;

  // State type
  stateType: StateType;

  // Initial value
  initialValue: StateValue;

  // Current value (updated during simulation)
  currentValue?: StateValue;

  // Clock sensitivity
  clockRef?: string; // Which clock drives this state
  edge?: 'rising' | 'falling';
}

type StateType = BitType | BusType | MemoryType;

interface MemoryType {
  kind: 'memory';
  addressWidth: number;
  dataWidth: number;
}

type StateValue = BitValue | BusValue | MemoryValue;

interface MemoryValue {
  // Sparse representation: only store non-zero values
  data: Map<number, number>;
  addressWidth: number;
  dataWidth: number;
}
```

### 8. Implementation

Specifies how a component is implemented.

```typescript
type Implementation = PrimitiveImpl | CompositeImpl | IntrinsicImpl;

interface PrimitiveImpl {
  kind: 'primitive';
  // Primitive components are provided by simulator kernel
  // Their behavior is hardcoded (And, Or, Not, etc.)
}

interface CompositeImpl {
  kind: 'composite';
  // Composite components are built from other components
  // The circuit's nodes and connections define the implementation
}

interface IntrinsicImpl {
  kind: 'intrinsic';
  // Intrinsic components have special simulator behavior
  // Examples: Display, DebugProbe, PerformanceCounter
  intrinsicType: string;
}
```

### 9. Parameters

Components can accept compile-time parameters.

```typescript
interface Parameter {
  name: string;
  paramType: ParameterType;
  defaultValue?: number | string | boolean;
}

type ParameterType = 'int' | 'string' | 'bool';
```

### 10. Metadata

Optional metadata for tooling and debugging.

```typescript
interface CircuitMetadata {
  // Source information
  source?: {
    filename?: string;
    lineNumber?: number;
  };

  // Documentation
  description?: string;
  author?: string;
  version?: string;

  // Testing
  testCases?: TestCase[];

  // Tags for categorization
  tags?: string[];
}

interface TestCase {
  name: string;
  inputs: Record<string, BitValue | BusValue>;
  expectedOutputs: Record<string, BitValue | BusValue>;
}
```

## Complete Example: HalfAdder

```json
{
  "id": "half_adder_001",
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
      "id": "node_xor_1",
      "label": "x1",
      "componentRef": "Xor",
      "arguments": {},
      "inputs": [
        { "id": "port_in_1", "name": "a", "portType": { "kind": "bit" } },
        { "id": "port_in_2", "name": "b", "portType": { "kind": "bit" } }
      ],
      "outputs": [
        { "id": "port_out_1", "name": "out", "portType": { "kind": "bit" } }
      ],
      "clocks": []
    },
    {
      "id": "node_and_1",
      "label": "a1",
      "componentRef": "And",
      "arguments": {},
      "inputs": [
        { "id": "port_in_3", "name": "a", "portType": { "kind": "bit" } },
        { "id": "port_in_4", "name": "b", "portType": { "kind": "bit" } }
      ],
      "outputs": [
        { "id": "port_out_2", "name": "out", "portType": { "kind": "bit" } }
      ],
      "clocks": []
    }
  ],
  "connections": [
    {
      "id": "conn_1",
      "source": { "nodeId": "", "portName": "a" },
      "target": { "nodeId": "node_xor_1", "portName": "a" },
      "portType": { "kind": "bit" }
    },
    {
      "id": "conn_2",
      "source": { "nodeId": "", "portName": "b" },
      "target": { "nodeId": "node_xor_1", "portName": "b" },
      "portType": { "kind": "bit" }
    },
    {
      "id": "conn_3",
      "source": { "nodeId": "node_xor_1", "portName": "out" },
      "target": { "nodeId": "", "portName": "sum" },
      "portType": { "kind": "bit" }
    },
    {
      "id": "conn_4",
      "source": { "nodeId": "", "portName": "a" },
      "target": { "nodeId": "node_and_1", "portName": "a" },
      "portType": { "kind": "bit" }
    },
    {
      "id": "conn_5",
      "source": { "nodeId": "", "portName": "b" },
      "target": { "nodeId": "node_and_1", "portName": "b" },
      "portType": { "kind": "bit" }
    },
    {
      "id": "conn_6",
      "source": { "nodeId": "node_and_1", "portName": "out" },
      "target": { "nodeId": "", "portName": "carry" },
      "portType": { "kind": "bit" }
    }
  ],
  "implementation": { "kind": "composite" }
}
```

## Execution Model

### Combinational Evaluation

For circuits without state (pure combinational logic):

1. **Build dependency graph** from connections
2. **Topological sort** to determine evaluation order
3. **Evaluate nodes** in dependency order:
   - Read input values from connected sources
   - Execute component logic
   - Write output values
4. **Propagate values** through connections
5. **Repeat until stable** (fixed-point reached)

### Sequential Evaluation (with State)

For circuits with registers/memory:

1. **Combinational phase:**
   - Evaluate all combinational logic
   - Determine next state based on current inputs and state

2. **Clock edge detection:**
   - Check which clocks have transitioned
   - Identify state blocks sensitive to those edges

3. **State update phase:**
   - Update state blocks triggered by clock edges
   - Apply new values atomically

4. **Next cycle:**
   - Return to combinational phase with updated state

### Simulation Loop

```
Initialize:
  - Set all state to initial values
  - Set all inputs to default (false/0)

Loop:
  1. Apply user input changes
  2. Run combinational evaluation
  3. Detect clock edges
  4. Update state blocks
  5. Emit outputs
  6. Advance time
  7. Repeat
```

## Optimization Passes

The IR supports various optimizations:

### 1. Constant Propagation
If an input is constant, propagate that value through the circuit.

### 2. Dead Code Elimination
Remove nodes whose outputs are never used.

### 3. Component Inlining
Replace a composite component with its internal nodes (flatten hierarchy).

### 4. Component Collapsing
Replace multiple primitive nodes with a single optimized node (e.g., chain of NOTs → wire).

### 5. Bus Width Reduction
If only some bits of a bus are used, reduce width and eliminate unused logic.

## Validation Rules

The IR must satisfy these invariants:

1. **Type consistency:** All connections must have matching port types
2. **No multiple drivers:** Each input port has at most one source
3. **Acyclic combinational paths:** No combinational loops (causes instability)
4. **Valid node references:** All componentRef fields resolve to known components
5. **Valid port paths:** All connections reference existing ports
6. **Clock consistency:** State blocks reference existing clock inputs
7. **Parameter consistency:** Node arguments match component parameter definitions

## Error Reporting

When validation fails, provide:
- Error type (type mismatch, multiple drivers, etc.)
- Location (circuit name, node ID, connection ID)
- Detailed message with actual vs expected values
- Suggestions for fixes

Example:
```
Error: Type mismatch on connection conn_7
  Circuit: FullAdder
  Source: ha1.sum (type: Bit)
  Target: output_bus (type: Bus[8])

  Cannot connect Bit to Bus[8] without explicit conversion.

  Suggestions:
  - Use a BitToBus adapter component
  - Change target type to Bit
  - Review circuit design
```

## Serialization Format

The IR serializes to JSON using the schemas defined above. File extension: `.tic` (Turing Incomplete Circuit).

Example file structure:
```
my-circuit.tic:
{
  "version": "0.1",
  "circuit": { ... }
}
```

## Component Library Structure

The complete system includes:

1. **IR format** (this spec)
2. **Primitive component definitions** (provided by simulator)
3. **Standard library** (composite components in IR format)
4. **User circuits** (also in IR format)

Libraries are loaded as collections of Circuit definitions. Name resolution searches these in order.

## Future Extensions

1. **Hierarchical inlining control:** Mark components as `inline` or `preserve`
2. **Optimization hints:** `@optimize(aggressive)` or `@preserve(debug)`
3. **Multi-clock domains:** Explicit clock domain tracking
4. **Bus slicing:** `bus[7:4]` for partial bus access
5. **Conditional connections:** Generated based on parameters
6. **Symbolic execution:** Track symbolic values for formal verification

## Relationship to DSL

```
DSL (human-friendly)
  ↓ parse
AST (syntax tree)
  ↓ name resolution
IR (executable, this spec)
  ↓ simulation
Results (port values, state)
```

The DSL is syntactic sugar over the IR. Everything expressible in DSL must have a clear IR representation.

## Relationship to UI

```
IR (structure and behavior)
  +
UI Metadata (positions, colors, etc.)
  ↓ projection
Visual Representation
```

The UI reads the IR and projects it to a visual form. UI changes may update metadata but should not modify IR semantics.

## Equivalence and Testing

Two circuits are behaviorally equivalent if:
- They have the same input/output ports
- For all input combinations, they produce the same outputs
- State transitions follow the same patterns

This can be verified through:
- Test cases (specified in metadata)
- Formal equivalence checking (future)
- Simulation comparison
