# Linking and Resolution Process

## Overview

The linking and resolution process transforms human-written DSL code into executable IR. This document specifies exactly how component references are resolved and validated.

## Pipeline Architecture

```
┌─────────────────┐
│   DSL Source    │  "circuit FullAdder { node ha1: HalfAdder ... }"
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Parser      │  Syntax analysis
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      AST        │  Abstract syntax tree (names are strings)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Symbol Table    │  Collect all component definitions
│   Builder       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Name Resolver   │  Resolve component references → definitions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Type Checker    │  Verify port types, connections
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  IR Generator   │  Lower to executable IR
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   IR (JSON)     │  Ready for simulation
└─────────────────┘
```

## Phase 1: Parsing

**Input:** DSL source code (text)
**Output:** Abstract Syntax Tree (AST)
**Errors:** Syntax errors only

The parser checks:
- Valid token sequences
- Balanced braces, parentheses
- Well-formed statements

The parser does NOT check:
- Whether component references exist
- Whether port types match
- Whether connections are valid

### Example AST Node

```typescript
interface ASTNode {
  kind: 'circuit' | 'node' | 'connect' | ...;
  location: SourceLocation;
}

interface CircuitNode extends ASTNode {
  kind: 'circuit';
  name: string;
  parameters: ParameterDecl[];
  inputs: PortDecl[];
  outputs: PortDecl[];
  clocks: ClockDecl[];
  state: StateDecl[];
  impl: ImplBlock;
}

interface NodeInstantiationNode extends ASTNode {
  kind: 'node';
  instanceName: string;
  componentName: string;  // Just a string! Not resolved yet
  arguments: ArgumentExpr[];
}
```

**Key Point:** At this stage, `componentName` is just a string. We don't know if it's valid.

## Phase 2: Symbol Table Building

**Input:** AST
**Output:** Symbol table (map of names → definitions)
**Errors:** Duplicate definitions

Build a table of all component definitions in scope:

```typescript
interface SymbolTable {
  primitives: Map<string, PrimitiveDefinition>;
  libraries: Map<string, Circuit>;
  userDefined: Map<string, Circuit>;
}
```

### Resolution Scopes

Symbols are searched in this order:

1. **Primitives** - Hardcoded simulator components
   ```
   And, Or, Xor, Not, Nand, Nor, Xnor, Buffer
   Register, RAM, ROM
   Add, Subtract, Multiply
   Mux, Demux
   ```

2. **Standard Library** - Pre-loaded composite components
   ```
   std.arithmetic.HalfAdder
   std.arithmetic.FullAdder
   std.memory.RegisterFile
   std.io.Display
   ```

3. **User Libraries** - Imported from other files
   ```
   import mylib.custom.SpecialAdder
   import utils.debugging.Probe
   ```

4. **Current File** - Components defined in this file
   ```
   circuit MyComponent { ... }
   circuit AnotherComponent { ... }
   ```

### Symbol Table Example

```typescript
const symbolTable: SymbolTable = {
  primitives: new Map([
    ['And', primitiveAndDefinition],
    ['Xor', primitiveXorDefinition],
    ['Register', primitiveRegisterDefinition],
    // ...
  ]),
  libraries: new Map([
    ['HalfAdder', stdLibHalfAdder],
    ['FullAdder', stdLibFullAdder],
    // ...
  ]),
  userDefined: new Map([
    ['MyCustomAdder', userCustomAdderCircuit],
    // ...
  ])
};
```

## Phase 3: Name Resolution

**Input:** AST + Symbol Table
**Output:** Resolved AST (references → definitions)
**Errors:** Undefined component, ambiguous reference

For each component instantiation:

```
node ha1: HalfAdder
          ^^^^^^^^^
          Resolve this
```

### Resolution Algorithm

```typescript
function resolveComponentReference(
  name: string,
  symbolTable: SymbolTable,
  location: SourceLocation
): ComponentDefinition | LinkError {
  // 1. Check primitives
  if (symbolTable.primitives.has(name)) {
    return symbolTable.primitives.get(name)!;
  }

  // 2. Check standard library
  if (symbolTable.libraries.has(name)) {
    return symbolTable.libraries.get(name)!;
  }

  // 3. Check user-defined
  if (symbolTable.userDefined.has(name)) {
    return symbolTable.userDefined.get(name)!;
  }

  // 4. Not found - return error
  return {
    type: 'undefined_component',
    name,
    location,
    suggestions: getSuggestions(name, symbolTable)
  };
}
```

### Shadowing Rules

1. **Primitives CANNOT be shadowed**
   ```
   circuit And { ... }  // ERROR: And is a primitive
   ```

2. **Library components CAN be shadowed by user components**
   ```
   // Standard library has HalfAdder
   circuit HalfAdder { ... }  // OK: shadows library version
   ```

3. **User components CANNOT shadow each other (within same file)**
   ```
   circuit Foo { ... }
   circuit Foo { ... }  // ERROR: Duplicate definition
   ```

## Phase 4: Type Checking

**Input:** Resolved AST
**Output:** Type-checked AST
**Errors:** Type mismatches, incompatible connections

### Port Type Checking

Every connection must satisfy:
```
source.type == target.type
```

Example:
```
connect a -> xor1.a
        ↑         ↑
     Bit type   Bit type  ✓ OK
```

```
connect bus -> gate.a
       ↑           ↑
    Bus[8]       Bit   ✗ ERROR: Type mismatch
```

### Type Checking Algorithm

```typescript
function checkConnection(
  conn: ConnectionNode,
  symbolTable: SymbolTable
): TypeCheckResult {
  // Resolve source port
  const sourcePort = resolvePortPath(conn.source);
  const sourceType = sourcePort.portType;

  // Resolve target port
  const targetPort = resolvePortPath(conn.target);
  const targetType = targetPort.portType;

  // Check compatibility
  if (!isPortTypeCompatible(sourceType, targetType)) {
    return {
      error: 'type_mismatch',
      source: { path: conn.source, type: sourceType },
      target: { path: conn.target, type: targetType },
      location: conn.location
    };
  }

  return { ok: true };
}
```

### Parameter Type Checking

When instantiating a parameterized component:

```
node adder: RippleCarryAdder(width = 8)
                             ^^^^^^^^^^
                             Check this
```

Verify:
1. All required parameters are provided
2. Parameter types match (e.g., `width` expects `Int`)
3. Parameter values are valid (e.g., `width > 0`)

### Multiple Driver Detection

Each input port can have at most one source:

```
connect a -> gate.x
connect b -> gate.x  // ERROR: Multiple drivers on gate.x
```

Algorithm:
```typescript
function checkMultipleDrivers(connections: Connection[]): ValidationError[] {
  const targetMap = new Map<string, PortPath[]>();

  for (const conn of connections) {
    const key = portPathKey(conn.target);
    if (!targetMap.has(key)) {
      targetMap.set(key, []);
    }
    targetMap.get(key)!.push(conn.source);
  }

  const errors: ValidationError[] = [];
  for (const [target, sources] of targetMap) {
    if (sources.length > 1) {
      errors.push({
        type: 'multiple_drivers',
        target,
        sources,
        message: `Port ${target} has ${sources.length} drivers (expected 1)`
      });
    }
  }

  return errors;
}
```

## Phase 5: Cycle Detection

**Input:** Type-checked AST
**Output:** Validated AST or cycle error
**Errors:** Combinational loops

Combinational logic cannot have cycles (causes oscillation/instability).

### Algorithm: Tarjan's Strongly Connected Components

```typescript
function detectCombinationalCycles(
  nodes: Node[],
  connections: Connection[]
): CycleDetectionResult {
  // Build directed graph (excluding clocked paths)
  const graph = buildCombinationalGraph(nodes, connections);

  // Find strongly connected components
  const sccs = tarjanSCC(graph);

  // Any SCC with size > 1 is a cycle
  const cycles = sccs.filter(scc => scc.length > 1);

  if (cycles.length > 0) {
    return {
      error: 'combinational_loop',
      cycles: cycles.map(describeCycle)
    };
  }

  return { ok: true };
}
```

**Note:** Cycles through registers/state are allowed (these are sequential circuits).

Example:
```
// This is OK - cycle goes through register
┌─────────┐
│  Adder  │ ──> Register ──┐
└─────────┘                │
     ▲                     │
     └─────────────────────┘
     (clocked feedback)

// This is ERROR - pure combinational cycle
┌─────────┐
│ Gate A  │ ──> Gate B ──┐
└─────────┘              │
     ▲                   │
     └───────────────────┘
     (infinite loop)
```

## Phase 6: IR Generation

**Input:** Validated AST
**Output:** IR (JSON)
**Errors:** Should not happen (all validation done)

Transform AST nodes to IR structures:

```typescript
function generateIR(circuit: CircuitNode, symbolTable: SymbolTable): Circuit {
  return {
    id: generateUniqueId(),
    name: circuit.name,
    parameters: circuit.parameters.map(generateParameter),
    inputs: circuit.inputs.map(generatePortDescriptor),
    outputs: circuit.outputs.map(generatePortDescriptor),
    clocks: circuit.clocks.map(generateClockDescriptor),
    state: circuit.state.map(generateStateBlock),
    nodes: circuit.impl.nodes.map(node => generateNode(node, symbolTable)),
    connections: circuit.impl.connections.map(generateConnection),
    implementation: determineImplementation(circuit, symbolTable),
    metadata: generateMetadata(circuit)
  };
}
```

## Error Messages

### Undefined Component

```
Error: Cannot resolve component 'HalfAder'
  at circuit FullAdder, line 8, column 15

  node ha1: HalfAder
            ^^^^^^^^^

  Component 'HalfAder' is not defined.

  Did you mean:
    - HalfAdder (std.arithmetic)
    - FullAdder (std.arithmetic)

  Check:
    - Spelling and capitalization
    - Import statements
    - Component is defined before use
```

### Type Mismatch

```
Error: Type mismatch on connection
  at circuit Example, line 15

  connect bus_signal -> bit_input
          ^^^^^^^^^^    ^^^^^^^^^
          Bus[8]        Bit

  Cannot connect Bus[8] to Bit.

  Suggestions:
    - Use bus_signal[0] to access a single bit
    - Change target type to Bus[8]
    - Use a BitToBus or BusToBit adapter component
```

### Multiple Drivers

```
Error: Multiple drivers on input port
  at circuit Example, line 20

  Port 'gate.a' has 2 drivers:
    1. signal_x (line 18)
    2. signal_y (line 20)

  Input ports must have exactly one driver.

  Fix:
    - Use a multiplexer to select between signals
    - Remove one connection
    - Review circuit design
```

### Combinational Loop

```
Error: Combinational loop detected
  at circuit Example

  Cycle path:
    gate1.out → gate2.in → gate2.out → gate1.in

  Combinational logic cannot have cycles.

  Fix:
    - Insert a register to break the loop
    - Redesign logic to be acyclic
    - Check if this should be sequential (clocked) logic
```

### Parameter Error

```
Error: Missing required parameter
  at circuit Example, line 10

  node adder: RippleCarryAdder()
              ^^^^^^^^^^^^^^^^^^

  Component 'RippleCarryAdder' requires parameter 'width'

  Fix:
    node adder: RippleCarryAdder(width = 8)
```

## Optimization: Incremental Linking

For large projects with many files:

1. **Parse each file** independently
2. **Cache parsed ASTs** (invalidate on file change)
3. **Build global symbol table** from all files
4. **Resolve and type-check** only changed files
5. **Generate IR** for changed components

This allows fast iteration without re-compiling everything.

## Testing the Linker

### Test Case 1: Valid Circuit

```
Input:
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

Expected: Valid IR, no errors
```

### Test Case 2: Undefined Component

```
Input:
  circuit Test {
    impl {
      node x: NonExistent
    }
  }

Expected: Link error "Cannot resolve component 'NonExistent'"
```

### Test Case 3: Type Mismatch

```
Input:
  circuit Test {
    input a: Bus[8]
    output b: Bit

    impl {
      connect a -> b  // ERROR: Bus[8] → Bit
    }
  }

Expected: Type error "Cannot connect Bus[8] to Bit"
```

### Test Case 4: Multiple Drivers

```
Input:
  circuit Test {
    input x: Bit
    input y: Bit
    output z: Bit

    impl {
      connect x -> z
      connect y -> z  // ERROR: Two drivers
    }
  }

Expected: Error "Multiple drivers on port z"
```

### Test Case 5: Combinational Loop

```
Input:
  circuit Test {
    impl {
      node g1: Not
      node g2: Not

      connect g1.out -> g2.in
      connect g2.out -> g1.in  // ERROR: Cycle
    }
  }

Expected: Error "Combinational loop detected"
```

## Summary

The linking and resolution process ensures that DSL code is:

1. **Syntactically valid** (parsing)
2. **Referentially valid** (name resolution)
3. **Type safe** (type checking)
4. **Structurally valid** (cycle detection)
5. **Executable** (IR generation)

This rigorous process catches errors early and provides helpful error messages, making the DSL easier to learn and use.
