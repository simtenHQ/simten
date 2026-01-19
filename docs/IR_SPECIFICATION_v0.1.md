# Formal IR Specification v0.1

## Table of Contents
1. [Overview](#overview)
2. [Type Definitions](#type-definitions)
3. [IR Data Structures](#ir-data-structures)
4. [Execution Model](#execution-model)
5. [IR Generation Pipeline](#ir-generation-pipeline)
6. [Serialization](#serialization)

---

## Overview

The Intermediate Representation (IR) is the **execution format** for the simulator. It is:

- **Complete**: Contains all information needed to execute the circuit
- **Flat**: No hierarchical structure (composites are fully expanded)
- **Typed**: All ports have explicit types and widths
- **Unambiguous**: Evaluation order is deterministic
- **Stateless metadata**: UI information is separate (metadata layer)

### IR vs DSL vs UI

```
DSL (Human/LLM)  ──parse──>  AST  ──link──>  IR  ──execute──>  Simulation
                                               │
                                               └──project──> UI State
                                               │
                                          metadata (positions, colors)
```

**Key Principle:** IR is the single source of truth. Everything else is derived or projected from it.

---

## Type Definitions

### Core Value Types

```typescript
/**
 * Bit vector: array of boolean values
 * Single bit: BitVector of length 1
 * Bus: BitVector of length N
 */
type BitVector = boolean[];

/**
 * Port data type
 */
type PortType =
  | { kind: 'Bit' }
  | { kind: 'Bus', width: number };

/**
 * Port direction
 */
type PortDirection = 'input' | 'output';

/**
 * Clock edge type
 */
type EdgeType = 'posedge' | 'negedge';
```

### Port Descriptor

```typescript
/**
 * Port fully describes an input or output connection point
 */
interface PortDescriptor {
  /** Unique port ID: "node_id.port_name" or "node_id.port_index" */
  id: string;

  /** Human-readable name (e.g., "a", "sum", "data_out") */
  name: string;

  /** Direction: input or output */
  direction: PortDirection;

  /** Data type and width */
  type: PortType;

  /** Parent node ID */
  nodeId: string;

  /** Port index on the node (for array ports) */
  index?: number;
}
```

### Node Descriptor

```typescript
/**
 * Node types
 */
type NodeType =
  | 'primitive'   // Kernel-provided logic (And, Or, Not, etc.)
  | 'foreign'     // Special I/O nodes (Input, Output, Probe)
  | 'constant';   // Constant value source

/**
 * Node represents a component instance in the IR
 */
interface NodeDescriptor {
  /** Unique node ID */
  id: string;

  /** Node type classification */
  nodeType: NodeType;

  /** Component type name (for primitive resolution) */
  componentType: string;

  /** Input ports (ordered) */
  inputs: PortDescriptor[];

  /** Output ports (ordered) */
  outputs: PortDescriptor[];

  /** Parameters (for primitives that need configuration) */
  params?: Record<string, ParamValue>;

  /** Human-readable label (optional) */
  label?: string;
}

/**
 * Parameter values
 */
type ParamValue =
  | number
  | string
  | boolean
  | BitVector;
```

### Connection Record

```typescript
/**
 * Connection represents a wire between two ports
 */
interface ConnectionRecord {
  /** Unique connection ID */
  id: string;

  /** Source port ID (must be an output port) */
  sourcePortId: string;

  /** Target port ID (must be an input port) */
  targetPortId: string;

  /** Source node ID (for quick lookup) */
  sourceNodeId: string;

  /** Target node ID (for quick lookup) */
  targetNodeId: string;
}
```

### State Block

```typescript
/**
 * Register state (single or bus)
 */
interface RegisterState {
  kind: 'register';

  /** Unique state ID */
  id: string;

  /** Data type and width */
  type: PortType;

  /** Current value */
  value: BitVector;

  /** Next value (staged for clock edge) */
  nextValue?: BitVector;

  /** Owning node ID */
  nodeId: string;

  /** Clock signal port ID */
  clockPortId: string;

  /** Edge type (posedge or negedge) */
  edgeType: EdgeType;
}

/**
 * Memory state (array of bit vectors)
 */
interface MemoryState {
  kind: 'memory';

  /** Unique state ID */
  id: string;

  /** Address width */
  addrWidth: number;

  /** Data width */
  dataWidth: number;

  /** Storage: 2^addrWidth entries of dataWidth bits */
  storage: BitVector[];

  /** Pending writes (staged for clock edge) */
  pendingWrites?: Map<number, BitVector>;

  /** Owning node ID */
  nodeId: string;

  /** Clock signal port ID */
  clockPortId: string;

  /** Edge type */
  edgeType: EdgeType;
}

type StateBlock = RegisterState | MemoryState;
```

### IR Structure

```typescript
/**
 * Complete IR for a circuit
 */
interface IR {
  /** All nodes in the circuit (flat) */
  nodes: Map<string, NodeDescriptor>;

  /** All connections between ports */
  connections: Map<string, ConnectionRecord>;

  /** All state blocks (registers and memory) */
  state: Map<string, StateBlock>;

  /** Topologically sorted node IDs (for combinational evaluation) */
  evalOrder: string[];

  /** Clock domains (if multi-clock) */
  clockDomains?: ClockDomain[];

  /** Metadata version (for compatibility) */
  version: string;
}

/**
 * Clock domain (for future multi-clock support)
 */
interface ClockDomain {
  id: string;
  clockPortId: string;
  stateIds: string[];
}
```

---

## IR Data Structures

### Node Map

The `nodes` map is the primary data structure:

```typescript
nodes: Map<string, NodeDescriptor>

// Example:
nodes = new Map([
  ['n1', {
    id: 'n1',
    nodeType: 'primitive',
    componentType: 'And',
    inputs: [
      { id: 'n1.a', name: 'a', direction: 'input', type: { kind: 'Bit' }, nodeId: 'n1' },
      { id: 'n1.b', name: 'b', direction: 'input', type: { kind: 'Bit' }, nodeId: 'n1' }
    ],
    outputs: [
      { id: 'n1.out', name: 'out', direction: 'output', type: { kind: 'Bit' }, nodeId: 'n1' }
    ]
  }],
  ['n2', { /* ... */ }]
]);
```

### Connection Map

The `connections` map represents all wires:

```typescript
connections: Map<string, ConnectionRecord>

// Example:
connections = new Map([
  ['c1', {
    id: 'c1',
    sourcePortId: 'n1.out',
    targetPortId: 'n2.a',
    sourceNodeId: 'n1',
    targetNodeId: 'n2'
  }]
]);
```

### State Map

The `state` map holds all stateful elements:

```typescript
state: Map<string, StateBlock>

// Example:
state = new Map([
  ['s1', {
    kind: 'register',
    id: 's1',
    type: { kind: 'Bit' },
    value: [false],
    nodeId: 'n5',
    clockPortId: 'n5.clk',
    edgeType: 'posedge'
  }]
]);
```

### Evaluation Order

The `evalOrder` array defines the order for combinational propagation:

```typescript
evalOrder: string[]  // Node IDs in topological order

// Example (assuming n1 -> n2 -> n3 dependencies):
evalOrder = ['n1', 'n2', 'n3']
```

**Invariant:** If there's a path from node A to node B, A appears before B in `evalOrder`.

---

## Execution Model

### Simulation Tick

A single simulation step consists of:

1. **Combinational Evaluation** (in `evalOrder`)
2. **Clock Edge Detection**
3. **State Updates**
4. **Output Stabilization**

### Combinational Evaluation

```typescript
function evaluateCombinational(ir: IR): PortValueMap {
  const portValues = new Map<string, BitVector>();

  // Initialize foreign inputs (Input nodes)
  for (const node of ir.nodes.values()) {
    if (node.nodeType === 'foreign' && node.componentType === 'Input') {
      portValues.set(node.outputs[0].id, node.value);
    }
  }

  // Evaluate in topological order
  for (const nodeId of ir.evalOrder) {
    const node = ir.nodes.get(nodeId)!;

    // Gather input values
    const inputs: BitVector[] = node.inputs.map(port => {
      // Find connection feeding this input
      const conn = findConnectionToPort(ir.connections, port.id);
      if (conn) {
        return portValues.get(conn.sourcePortId) || defaultValue(port.type);
      }
      return defaultValue(port.type);
    });

    // Evaluate node
    const outputs = evaluateNode(node, inputs);

    // Store output values
    outputs.forEach((value, index) => {
      portValues.set(node.outputs[index].id, value);
    });
  }

  return portValues;
}
```

### Node Evaluation

```typescript
function evaluateNode(node: NodeDescriptor, inputs: BitVector[]): BitVector[] {
  if (node.nodeType === 'primitive') {
    return evaluatePrimitive(node.componentType, inputs, node.params);
  }

  if (node.nodeType === 'foreign') {
    return evaluateForeign(node, inputs);
  }

  if (node.nodeType === 'constant') {
    return [node.params!.value as BitVector];
  }

  throw new Error(`Unknown node type: ${node.nodeType}`);
}
```

### Primitive Evaluation

```typescript
const PRIMITIVE_EVALUATORS: Map<string, PrimitiveEvaluator> = new Map([
  ['And', (inputs) => {
    const [a, b] = inputs;
    return [a.map((bit, i) => bit && b[i])];
  }],
  ['Or', (inputs) => {
    const [a, b] = inputs;
    return [a.map((bit, i) => bit || b[i])];
  }],
  ['Not', (inputs) => {
    const [a] = inputs;
    return [a.map(bit => !bit)];
  }],
  ['Xor', (inputs) => {
    const [a, b] = inputs;
    return [a.map((bit, i) => bit !== b[i])];
  }],
  // ... more primitives
]);

function evaluatePrimitive(
  type: string,
  inputs: BitVector[],
  params?: Record<string, ParamValue>
): BitVector[] {
  const evaluator = PRIMITIVE_EVALUATORS.get(type);
  if (!evaluator) {
    throw new Error(`Unknown primitive: ${type}`);
  }
  return evaluator(inputs);
}
```

### Clock Edge Detection

```typescript
function detectClockEdges(
  ir: IR,
  prevPortValues: PortValueMap,
  currPortValues: PortValueMap
): Set<string> {
  const triggeredEdges = new Set<string>();

  for (const stateBlock of ir.state.values()) {
    const clockPort = stateBlock.clockPortId;
    const prev = prevPortValues.get(clockPort)?.[0] || false;
    const curr = currPortValues.get(clockPort)?.[0] || false;

    if (stateBlock.edgeType === 'posedge' && !prev && curr) {
      triggeredEdges.add(stateBlock.id);
    } else if (stateBlock.edgeType === 'negedge' && prev && !curr) {
      triggeredEdges.add(stateBlock.id);
    }
  }

  return triggeredEdges;
}
```

### State Updates

```typescript
function updateState(
  ir: IR,
  triggeredEdges: Set<string>
): void {
  for (const stateId of triggeredEdges) {
    const stateBlock = ir.state.get(stateId)!;

    if (stateBlock.kind === 'register') {
      if (stateBlock.nextValue !== undefined) {
        stateBlock.value = stateBlock.nextValue;
        stateBlock.nextValue = undefined;
      }
    } else if (stateBlock.kind === 'memory') {
      if (stateBlock.pendingWrites) {
        for (const [addr, data] of stateBlock.pendingWrites) {
          stateBlock.storage[addr] = data;
        }
        stateBlock.pendingWrites = undefined;
      }
    }
  }
}
```

### Complete Simulation Step

```typescript
function simulationStep(
  ir: IR,
  prevPortValues: PortValueMap
): PortValueMap {
  // 1. Evaluate combinational logic
  const currPortValues = evaluateCombinational(ir);

  // 2. Detect clock edges
  const triggeredEdges = detectClockEdges(ir, prevPortValues, currPortValues);

  // 3. Update state on clock edges
  updateState(ir, triggeredEdges);

  // 4. Re-evaluate if state changed (output stabilization)
  if (triggeredEdges.size > 0) {
    return evaluateCombinational(ir);
  }

  return currPortValues;
}
```

---

## IR Generation Pipeline

### Step 1: Parse DSL to AST

```typescript
interface ASTComponent {
  name: string;
  params: ASTParam[];
  inputs: ASTPort[];
  outputs: ASTPort[];
  nodes: ASTNode[];
  connections: ASTConnection[];
  state: ASTState[];
  clockEdges: ASTClockEdge[];
}

interface ASTNode {
  name: string;           // Instance name (e.g., "xor1")
  type: string;           // Component type (e.g., "Xor")
  params: ASTParamValue[];
}

interface ASTConnection {
  source: ASTPortRef;     // e.g., "this.a" or "xor1.out"
  target: ASTPortRef;
}
```

### Step 2: Resolve Symbols

```typescript
interface ComponentLibrary {
  lookup(name: string): ComponentDefinition | null;
  primitives(): Map<string, PrimitiveSpec>;
}

function resolveComponent(
  ast: ASTComponent,
  library: ComponentLibrary
): ResolvedComponent {
  // Resolve all node types
  const resolvedNodes = ast.nodes.map(node => {
    const def = library.lookup(node.type);
    if (!def) {
      throw new LinkError(`Undefined component: ${node.type}`);
    }
    return { node, definition: def };
  });

  return { ast, resolvedNodes };
}
```

### Step 3: Expand Composites

```typescript
function expandComposite(
  resolved: ResolvedComponent,
  library: ComponentLibrary
): ExpandedComponent {
  const nodes: NodeDescriptor[] = [];

  for (const { node, definition } of resolved.resolvedNodes) {
    if (definition.type === 'primitive') {
      // Create IR node directly
      nodes.push(createPrimitiveNode(node, definition));
    } else if (definition.type === 'composite') {
      // Recursively expand
      const expanded = expandComposite(
        resolveComponent(definition.ast, library),
        library
      );
      nodes.push(...expanded.nodes);
    }
  }

  return { nodes };
}
```

### Step 4: Flatten Connections

```typescript
function flattenConnections(
  ast: ASTComponent,
  nodeMap: Map<string, NodeDescriptor>
): ConnectionRecord[] {
  const connections: ConnectionRecord[] = [];

  for (const conn of ast.connections) {
    const sourcePort = resolvePortRef(conn.source, nodeMap);
    const targetPort = resolvePortRef(conn.target, nodeMap);

    // Validate: source must be output, target must be input
    if (sourcePort.direction !== 'output') {
      throw new Error(`Source port must be output: ${conn.source}`);
    }
    if (targetPort.direction !== 'input') {
      throw new Error(`Target port must be input: ${conn.target}`);
    }

    // Validate: types must match
    if (!typesMatch(sourcePort.type, targetPort.type)) {
      throw new Error(`Type mismatch: ${sourcePort.type} vs ${targetPort.type}`);
    }

    connections.push({
      id: generateId(),
      sourcePortId: sourcePort.id,
      targetPortId: targetPort.id,
      sourceNodeId: sourcePort.nodeId,
      targetNodeId: targetPort.nodeId
    });
  }

  return connections;
}
```

### Step 5: Extract State

```typescript
function extractState(
  ast: ASTComponent,
  nodeMap: Map<string, NodeDescriptor>
): StateBlock[] {
  const state: StateBlock[] = [];

  for (const stateDecl of ast.state) {
    if (stateDecl.kind === 'register') {
      state.push({
        kind: 'register',
        id: generateId(),
        type: stateDecl.type,
        value: stateDecl.initialValue,
        nodeId: stateDecl.nodeId,
        clockPortId: stateDecl.clockPortId,
        edgeType: stateDecl.edgeType
      });
    } else if (stateDecl.kind === 'memory') {
      state.push({
        kind: 'memory',
        id: generateId(),
        addrWidth: stateDecl.addrWidth,
        dataWidth: stateDecl.dataWidth,
        storage: initializeMemory(stateDecl),
        nodeId: stateDecl.nodeId,
        clockPortId: stateDecl.clockPortId,
        edgeType: stateDecl.edgeType
      });
    }
  }

  return state;
}
```

### Step 6: Topological Sort

```typescript
function computeEvalOrder(
  nodes: Map<string, NodeDescriptor>,
  connections: Map<string, ConnectionRecord>
): string[] {
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  // Initialize
  for (const nodeId of nodes.keys()) {
    graph.set(nodeId, new Set());
    inDegree.set(nodeId, 0);
  }

  // Build dependency graph
  for (const conn of connections.values()) {
    const source = conn.sourceNodeId;
    const target = conn.targetNodeId;

    if (!graph.get(source)!.has(target)) {
      graph.get(source)!.add(target);
      inDegree.set(target, inDegree.get(target)! + 1);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: string[] = [];

  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    for (const neighbor of graph.get(current)!) {
      const newDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycles
  if (result.length !== nodes.size) {
    throw new Error('Cycle detected in circuit');
  }

  return result;
}
```

### Complete IR Generation

```typescript
function generateIR(
  dslText: string,
  library: ComponentLibrary
): IR {
  // 1. Parse
  const ast = parseDSL(dslText);

  // 2. Resolve symbols
  const resolved = resolveComponent(ast, library);

  // 3. Expand composites
  const expanded = expandComposite(resolved, library);

  // 4. Create node map
  const nodes = new Map(expanded.nodes.map(n => [n.id, n]));

  // 5. Flatten connections
  const connectionList = flattenConnections(ast, nodes);
  const connections = new Map(connectionList.map(c => [c.id, c]));

  // 6. Extract state
  const stateList = extractState(ast, nodes);
  const state = new Map(stateList.map(s => [s.id, s]));

  // 7. Compute evaluation order
  const evalOrder = computeEvalOrder(nodes, connections);

  return {
    nodes,
    connections,
    state,
    evalOrder,
    version: '0.1.0'
  };
}
```

---

## Serialization

### JSON Schema

The IR can be serialized to JSON for persistence and interchange:

```json
{
  "version": "0.1.0",
  "nodes": {
    "n1": {
      "id": "n1",
      "nodeType": "primitive",
      "componentType": "And",
      "inputs": [
        {
          "id": "n1.a",
          "name": "a",
          "direction": "input",
          "type": { "kind": "Bit" },
          "nodeId": "n1"
        },
        {
          "id": "n1.b",
          "name": "b",
          "direction": "input",
          "type": { "kind": "Bit" },
          "nodeId": "n1"
        }
      ],
      "outputs": [
        {
          "id": "n1.out",
          "name": "out",
          "direction": "output",
          "type": { "kind": "Bit" },
          "nodeId": "n1"
        }
      ]
    }
  },
  "connections": {
    "c1": {
      "id": "c1",
      "sourcePortId": "n1.out",
      "targetPortId": "n2.a",
      "sourceNodeId": "n1",
      "targetNodeId": "n2"
    }
  },
  "state": {},
  "evalOrder": ["n1", "n2"]
}
```

### Serialization Functions

```typescript
function serializeIR(ir: IR): string {
  return JSON.stringify({
    version: ir.version,
    nodes: Object.fromEntries(ir.nodes),
    connections: Object.fromEntries(ir.connections),
    state: Object.fromEntries(ir.state),
    evalOrder: ir.evalOrder,
    clockDomains: ir.clockDomains
  }, null, 2);
}

function deserializeIR(json: string): IR {
  const obj = JSON.parse(json);

  return {
    version: obj.version,
    nodes: new Map(Object.entries(obj.nodes)),
    connections: new Map(Object.entries(obj.connections)),
    state: new Map(Object.entries(obj.state)),
    evalOrder: obj.evalOrder,
    clockDomains: obj.clockDomains
  };
}
```

---

## IR Validation

### Validation Rules

```typescript
function validateIR(ir: IR): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. All port IDs in connections must reference existing ports
  for (const conn of ir.connections.values()) {
    if (!portExists(ir, conn.sourcePortId)) {
      errors.push({ type: 'missing_port', id: conn.sourcePortId });
    }
    if (!portExists(ir, conn.targetPortId)) {
      errors.push({ type: 'missing_port', id: conn.targetPortId });
    }
  }

  // 2. Source ports must be outputs
  for (const conn of ir.connections.values()) {
    const sourcePort = findPort(ir, conn.sourcePortId);
    if (sourcePort && sourcePort.direction !== 'output') {
      errors.push({ type: 'invalid_source', id: conn.sourcePortId });
    }
  }

  // 3. Target ports must be inputs
  for (const conn of ir.connections.values()) {
    const targetPort = findPort(ir, conn.targetPortId);
    if (targetPort && targetPort.direction !== 'input') {
      errors.push({ type: 'invalid_target', id: conn.targetPortId });
    }
  }

  // 4. No multiple drivers (one source per input)
  const inputDrivers = new Map<string, string[]>();
  for (const conn of ir.connections.values()) {
    const drivers = inputDrivers.get(conn.targetPortId) || [];
    drivers.push(conn.sourcePortId);
    inputDrivers.set(conn.targetPortId, drivers);
  }
  for (const [portId, drivers] of inputDrivers) {
    if (drivers.length > 1) {
      errors.push({ type: 'multiple_drivers', portId, drivers });
    }
  }

  // 5. Evaluation order must be valid topological sort
  const recomputed = computeEvalOrder(ir.nodes, ir.connections);
  if (JSON.stringify(recomputed) !== JSON.stringify(ir.evalOrder)) {
    errors.push({ type: 'invalid_eval_order' });
  }

  // 6. State blocks must reference valid nodes and clock ports
  for (const stateBlock of ir.state.values()) {
    if (!ir.nodes.has(stateBlock.nodeId)) {
      errors.push({ type: 'invalid_state_node', id: stateBlock.nodeId });
    }
    if (!portExists(ir, stateBlock.clockPortId)) {
      errors.push({ type: 'invalid_clock_port', id: stateBlock.clockPortId });
    }
  }

  return errors;
}
```

---

## Performance Considerations

### Memory Layout

For optimal cache performance:
- Store port values in contiguous arrays indexed by port ID
- Use typed arrays for bit vectors (`Uint8Array` for bits)
- Pre-allocate arrays based on node count

### Evaluation Optimization

```typescript
// Instead of Map lookups, use direct array indexing
const portValueArray = new Uint8Array(maxPortId);
const nodeEvalOrder = new Uint32Array(nodes.size);

function evaluateCombinationalOptimized(ir: IR): Uint8Array {
  const portValues = new Uint8Array(maxPortId);

  for (let i = 0; i < nodeEvalOrder.length; i++) {
    const nodeIndex = nodeEvalOrder[i];
    const node = nodesArray[nodeIndex];

    // Gather inputs (direct array access)
    const inputCount = node.inputCount;
    for (let j = 0; j < inputCount; j++) {
      inputs[j] = portValues[node.inputPortIds[j]];
    }

    // Evaluate
    evaluatePrimitive(node.primitiveType, inputs, outputs);

    // Store outputs (direct array access)
    const outputCount = node.outputCount;
    for (let j = 0; j < outputCount; j++) {
      portValues[node.outputPortIds[j]] = outputs[j];
    }
  }

  return portValues;
}
```

### Connection Indexing

For fast connection lookup:
```typescript
// Pre-build reverse index: input port -> source port
const inputSourceMap = new Map<string, string>();
for (const conn of connections.values()) {
  inputSourceMap.set(conn.targetPortId, conn.sourcePortId);
}
```

---

## Summary

This IR specification provides:

1. **Complete type definitions** for all IR structures
2. **Deterministic execution model** with well-defined evaluation order
3. **Clear separation** between IR (structure) and metadata (UI)
4. **Efficient serialization** to/from JSON
5. **Validation rules** to ensure IR integrity
6. **Performance optimizations** for large circuits
7. **Extension points** for future features (multi-clock, assertions)

The IR is the **execution substrate** - everything the simulator needs, nothing it doesn't.
