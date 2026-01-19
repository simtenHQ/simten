# Execution Semantics

## Overview

This document specifies exactly how circuits are executed in the simulator. The execution model is:
- **Deterministic** - same inputs always produce same outputs
- **Discrete-time** - simulation proceeds in distinct clock cycles
- **Event-driven** - only re-evaluate when inputs change (optimization)

## CRITICAL PRINCIPLE: Evaluation Always Reduces to Primitives

**Only primitive components contain executable behavior. All execution ultimately reduces to primitive operations.**

During simulation:
1. **Primitive components** (And, Or, Not, Register, etc.) have evaluate() functions that execute their hardcoded logic
2. **Composite components** have NO evaluate() functions - they are expanded (inlined) into their constituent primitives
3. The expanded circuit becomes a flat graph of primitive operations
4. Evaluation proceeds by executing primitive logic functions only
5. No "composite-level" behavior exists - only primitive evaluations

**Example execution flow:**

```
User circuit contains: node ha: HalfAdder
                              ↓
Expansion phase: Replace HalfAdder with its definition
                              ↓
                       node ha_xor: Xor (primitive)
                       node ha_and: And (primitive)
                              ↓
Evaluation phase: Execute ONLY primitive evaluators
                              ↓
                       ha_xor.out = Xor.evaluate(a, b)  ← Primitive behavior
                       ha_and.out = And.evaluate(a, b)  ← Primitive behavior
                              ↓
Output: ha.sum = ha_xor.out, ha.carry = ha_and.out
```

**There is NO separate "HalfAdder.evaluate()" function.** The HalfAdder's behavior emerges from the primitive evaluations of its internal Xor and And gates. HalfAdder is purely structural.

This ensures:
- No hidden behavior or magic in composites
- Complete transparency and debuggability
- Consistent execution model at all levels
- Only primitives contain executable logic
- Optimization freedom (can eliminate intermediate structures)

## Execution Modes

### 1. Combinational Evaluation

For circuits without state (no registers, no clocks), evaluation is straightforward:

1. Apply input values
2. Propagate through circuit until stable
3. Read output values

### 2. Sequential Evaluation

For circuits with state (registers, memory), evaluation proceeds in cycles:

1. **Combinational phase** - Compute next state and outputs from current state and inputs
2. **Clock edge** - Detect clock transitions
3. **State update phase** - Update state on clock edges
4. **Repeat**

## Combinational Evaluation Algorithm

### Input
- IR: Circuit structure (nodes, connections)
- Input values: Map<PortPath, Value>

### Output
- Port values: Map<PortPath, Value>
- Errors: Cycle detection, convergence failure

### Algorithm

```typescript
function evaluateCombinational(
  circuit: Circuit,
  inputs: Map<string, BitValue | BusValue>
): EvaluationResult {
  // Step 1: Build dependency graph
  const graph = buildDependencyGraph(circuit);

  // Step 2: Topological sort
  const order = topologicalSort(graph);
  if (order === null) {
    return { error: 'combinational_loop' };
  }

  // Step 3: Initialize port values
  const portValues = new Map<string, BitValue | BusValue>();

  // Set circuit inputs
  for (const [portName, value] of inputs) {
    const path = createPortPath('', portName);
    portValues.set(portPathKey(path), value);
  }

  // Step 4: Evaluate nodes in topological order
  for (const nodeId of order) {
    const node = circuit.nodes.find(n => n.id === nodeId)!;

    // Gather input values for this node
    const nodeInputs = gatherNodeInputs(node, circuit.connections, portValues);

    // Evaluate node (execute its logic)
    const nodeOutputs = evaluateNode(node, nodeInputs);

    // Store output values
    for (const [portName, value] of nodeOutputs) {
      const path = createPortPath(nodeId, portName);
      portValues.set(portPathKey(path), value);
    }
  }

  // Step 5: Propagate to circuit outputs
  const outputs = new Map<string, BitValue | BusValue>();
  for (const outputPort of circuit.outputs) {
    const value = traceOutputValue(outputPort.name, circuit.connections, portValues);
    outputs.set(outputPort.name, value);
  }

  return { portValues, outputs };
}
```

### Dependency Graph Construction

```typescript
function buildDependencyGraph(circuit: Circuit): DependencyGraph {
  const graph = new Map<string, Set<string>>();

  // Initialize all nodes
  for (const node of circuit.nodes) {
    graph.set(node.id, new Set());
  }

  // For each connection: target depends on source
  for (const conn of circuit.connections) {
    // Skip connections to/from circuit ports
    if (conn.source.nodeId === '' || conn.target.nodeId === '') {
      continue;
    }

    // Target node depends on source node
    const targetNode = conn.target.nodeId;
    const sourceNode = conn.source.nodeId;

    graph.get(targetNode)?.add(sourceNode);
  }

  return graph;
}
```

### Topological Sort (Kahn's Algorithm)

```typescript
function topologicalSort(graph: DependencyGraph): string[] | null {
  const inDegree = new Map<string, number>();
  const queue: string[] = [];
  const result: string[] = [];

  // Calculate in-degrees
  for (const [node, deps] of graph) {
    inDegree.set(node, deps.size);
    if (deps.size === 0) {
      queue.push(node);
    }
  }

  // Process nodes with no dependencies
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    // Reduce in-degree of dependent nodes
    for (const [node, deps] of graph) {
      if (deps.has(current)) {
        deps.delete(current);
        const newDegree = deps.size;
        if (newDegree === 0) {
          queue.push(node);
        }
      }
    }
  }

  // If not all nodes processed, there's a cycle
  if (result.length !== graph.size) {
    return null;
  }

  return result;
}
```

### Node Evaluation

```typescript
function evaluateNode(
  node: Node,
  inputs: Map<string, BitValue | BusValue>
): Map<string, BitValue | BusValue> {
  // Get component definition
  const component = resolveComponent(node.componentRef);

  switch (component.implementation.kind) {
    case 'primitive':
      return evaluatePrimitive(component, inputs);

    case 'composite':
      return evaluateComposite(component, inputs);

    case 'intrinsic':
      return evaluateIntrinsic(component, inputs);
  }
}
```

### Primitive Evaluation

Primitives have hardcoded logic:

```typescript
const PRIMITIVE_EVALUATORS: Record<string, PrimitiveEvaluator> = {
  'And': (inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', a && b]]);
  },

  'Or': (inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', a || b]]);
  },

  'Xor': (inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', a !== b]]);
  },

  'Not': (inputs) => {
    const a = inputs.get('a') as boolean;
    return new Map([['out', !a]]);
  },

  // ... more primitives
};
```

### Composite Evaluation

**Composites have NO evaluation function and NO inherent behavior - they are expanded into primitives.**

The correct implementation is:

```typescript
function evaluateComposite(
  component: Circuit,
  inputs: Map<string, BitValue | BusValue>
): Map<string, BitValue | BusValue> {
  // IMPORTANT: This function doesn't "execute" the composite
  // Composites have NO executable behavior - they are purely structural
  // This function expands the composite into its constituent primitives
  // and then evaluates ONLY those primitives

  // Step 1: Expand composite to flat primitive circuit
  const expandedCircuit = expandAllComposites(component);

  // Step 2: Evaluate the expanded (all-primitive) circuit
  return evaluateCombinational(expandedCircuit, inputs).outputs;

  // NOTE: The "behavior" comes from the primitives in expandedCircuit,
  // NOT from any inherent composite logic (composites have no logic)
}
```

**Key insight:** The recursive call to `evaluateCombinational` operates on an expanded circuit where all composites have been replaced with primitives. At the bottom of the recursion, we only evaluate primitives (which DO have inherent behavior via their hardcoded evaluate() functions).

## Sequential Evaluation Algorithm

### Input
- IR: Circuit with state
- Input values: Map<PortPath, Value>
- Clock signals: Map<ClockPath, boolean>
- Previous state: Map<StatePath, StateValue>

### Output
- Port values: Map<PortPath, Value>
- New state: Map<StatePath, StateValue>

### Algorithm

```typescript
function evaluateSequential(
  circuit: Circuit,
  inputs: Map<string, BitValue | BusValue>,
  clockValues: Map<string, boolean>,
  previousClockValues: Map<string, boolean>,
  currentState: Map<string, StateValue>
): SequentialEvaluationResult {
  // Step 1: Detect clock edges
  const clockEdges = detectClockEdges(clockValues, previousClockValues);

  // Step 2: Evaluate combinational logic (same as pure combinational)
  const combResult = evaluateCombinational(circuit, inputs);

  // Step 3: Determine next state
  const nextState = new Map<string, StateValue>(currentState);

  for (const stateBlock of circuit.state) {
    // Check if this state is triggered by current clock edge
    if (stateBlock.clockRef) {
      const edge = clockEdges.get(stateBlock.clockRef);

      if (edge === stateBlock.edge) {
        // Update state based on evaluated inputs
        const newValue = evaluateStateUpdate(
          stateBlock,
          combResult.portValues,
          currentState
        );
        nextState.set(stateBlock.id, newValue);
      }
    }
  }

  return {
    portValues: combResult.portValues,
    outputs: combResult.outputs,
    nextState
  };
}
```

### Clock Edge Detection

```typescript
function detectClockEdges(
  current: Map<string, boolean>,
  previous: Map<string, boolean>
): Map<string, 'rising' | 'falling' | 'none'> {
  const edges = new Map<string, 'rising' | 'falling' | 'none'>();

  for (const [clockName, currentValue] of current) {
    const previousValue = previous.get(clockName) ?? false;

    if (!previousValue && currentValue) {
      edges.set(clockName, 'rising');
    } else if (previousValue && !currentValue) {
      edges.set(clockName, 'falling');
    } else {
      edges.set(clockName, 'none');
    }
  }

  return edges;
}
```

## Simulation Loop

The main simulation loop runs continuously:

```typescript
class Simulator {
  private circuit: Circuit;
  private state: Map<string, StateValue>;
  private clockValues: Map<string, boolean>;
  private previousClockValues: Map<string, boolean>;
  private cycleCount: number;

  constructor(circuit: Circuit) {
    this.circuit = circuit;
    this.state = initializeState(circuit);
    this.clockValues = new Map();
    this.previousClockValues = new Map();
    this.cycleCount = 0;
  }

  step(inputs: Map<string, BitValue | BusValue>): SimulationStepResult {
    // Evaluate circuit
    const result = evaluateSequential(
      this.circuit,
      inputs,
      this.clockValues,
      this.previousClockValues,
      this.state
    );

    // Update state for next cycle
    this.state = result.nextState;
    this.previousClockValues = new Map(this.clockValues);
    this.cycleCount++;

    return {
      outputs: result.outputs,
      cycle: this.cycleCount,
      state: this.state
    };
  }

  setClock(clockName: string, value: boolean): void {
    this.previousClockValues.set(clockName, this.clockValues.get(clockName) ?? false);
    this.clockValues.set(clockName, value);
  }

  reset(): void {
    this.state = initializeState(this.circuit);
    this.clockValues.clear();
    this.previousClockValues.clear();
    this.cycleCount = 0;
  }
}
```

### Usage Example

```typescript
// Create simulator
const circuit = loadCircuit('Counter8.json');
const sim = new Simulator(circuit);

// Run simulation
for (let i = 0; i < 10; i++) {
  // Set inputs
  const inputs = new Map([['reset', false]]);

  // Rising edge
  sim.setClock('clk', true);
  const result1 = sim.step(inputs);
  console.log(`Cycle ${result1.cycle}, count = ${result1.outputs.get('count')}`);

  // Falling edge
  sim.setClock('clk', false);
  const result2 = sim.step(inputs);
  console.log(`Cycle ${result2.cycle}, count = ${result2.outputs.get('count')}`);
}
```

## State Management

### State Types

**1. Register (single value)**

```typescript
interface RegisterState {
  id: string;
  name: string;
  stateType: BitType | BusType;
  currentValue: BitValue | BusValue;
}
```

**2. Memory (array of values)**

```typescript
interface MemoryState {
  id: string;
  name: string;
  stateType: MemoryType;
  currentValue: Map<number, number>; // Sparse storage
}
```

### State Initialization

```typescript
function initializeState(circuit: Circuit): Map<string, StateValue> {
  const state = new Map<string, StateValue>();

  for (const stateBlock of circuit.state) {
    state.set(stateBlock.id, stateBlock.initialValue);
  }

  return state;
}
```

### State Update Logic

```typescript
function evaluateStateUpdate(
  stateBlock: StateBlock,
  portValues: Map<string, BitValue | BusValue>,
  currentState: Map<string, StateValue>
): StateValue {
  // For a simple register: next value comes from input port
  if (stateBlock.stateType.kind === 'bit' || stateBlock.stateType.kind === 'bus') {
    // Find the connection to this state's input
    const inputValue = findStateInputValue(stateBlock, portValues);
    return inputValue;
  }

  // For memory: handle read/write operations
  if (stateBlock.stateType.kind === 'memory') {
    return evaluateMemoryUpdate(stateBlock, portValues, currentState);
  }

  return currentState.get(stateBlock.id)!;
}
```

## Memory Semantics

Memory operations have specific timing:

### Read (Combinational)
Memory reads are immediate - output reflects current address:

```typescript
function memoryRead(
  memory: MemoryValue,
  address: number
): number {
  return memory.data.get(address) ?? 0;
}
```

### Write (Sequential)
Memory writes occur on clock edges:

```typescript
function memoryWrite(
  memory: MemoryValue,
  address: number,
  data: number,
  writeEnable: boolean
): MemoryValue {
  if (writeEnable) {
    const newMemory = { ...memory };
    newMemory.data = new Map(memory.data);
    newMemory.data.set(address, data);
    return newMemory;
  }
  return memory;
}
```

### Read/Write Same Cycle
When reading and writing to same address in one cycle:

**Option 1: Read-before-write** (most common)
```
Output shows OLD value, write happens after read
```

**Option 2: Write-through**
```
Output shows NEW value immediately
```

We use **read-before-write** for predictability.

## Performance Optimizations

### 1. Incremental Evaluation

Only re-evaluate nodes whose inputs changed:

```typescript
function incrementalEvaluate(
  circuit: Circuit,
  changedInputs: Set<string>,
  previousPortValues: Map<string, BitValue | BusValue>
): Map<string, BitValue | BusValue> {
  // Build fanout map: which nodes depend on each signal
  const fanout = buildFanoutMap(circuit);

  // Start with changed inputs
  const dirtyNodes = new Set<string>();
  for (const inputPort of changedInputs) {
    for (const dependentNode of fanout.get(inputPort) ?? []) {
      dirtyNodes.add(dependentNode);
    }
  }

  // Topological sort of dirty nodes only
  const order = topologicalSortSubset(circuit, dirtyNodes);

  // Evaluate only dirty nodes
  const newPortValues = new Map(previousPortValues);
  for (const nodeId of order) {
    const node = circuit.nodes.find(n => n.id === nodeId)!;
    const inputs = gatherNodeInputs(node, circuit.connections, newPortValues);
    const outputs = evaluateNode(node, inputs);

    // Update values and mark downstream nodes dirty
    for (const [portName, value] of outputs) {
      const path = createPortPath(nodeId, portName);
      const key = portPathKey(path);

      // Only propagate if value actually changed
      if (newPortValues.get(key) !== value) {
        newPortValues.set(key, value);

        // Mark downstream nodes dirty
        for (const downstream of fanout.get(key) ?? []) {
          dirtyNodes.add(downstream);
        }
      }
    }
  }

  return newPortValues;
}
```

### 2. Component Inlining

Flatten composite components to reduce function call overhead:

```typescript
function inlineComponent(circuit: Circuit, nodeId: string): Circuit {
  const node = circuit.nodes.find(n => n.id === nodeId)!;
  const component = resolveComponent(node.componentRef);

  if (component.implementation.kind !== 'composite') {
    return circuit; // Can't inline primitives or intrinsics
  }

  // Copy component's internal nodes into parent circuit
  const inlinedNodes = component.nodes.map(n => ({
    ...n,
    id: `${nodeId}_${n.id}` // Prefix to avoid conflicts
  }));

  // Rewire connections
  const inlinedConnections = rewireConnections(
    component.connections,
    nodeId,
    circuit.connections
  );

  // Replace node with inlined version
  return {
    ...circuit,
    nodes: circuit.nodes.filter(n => n.id !== nodeId).concat(inlinedNodes),
    connections: inlinedConnections
  };
}
```

### 3. Constant Propagation

Replace nodes with constant inputs with constant outputs:

```typescript
function constantPropagation(circuit: Circuit): Circuit {
  const portValues = new Map<string, BitValue | BusValue>();

  // Find constant sources (unconnected inputs default to 0/false)
  for (const node of circuit.nodes) {
    for (const input of node.inputs) {
      if (!isConnected(input, circuit.connections)) {
        portValues.set(portPathKey({ nodeId: node.id, portName: input.name }), false);
      }
    }
  }

  // Propagate constants
  let changed = true;
  while (changed) {
    changed = false;

    for (const node of circuit.nodes) {
      // If all inputs are constant
      const inputs = gatherNodeInputs(node, circuit.connections, portValues);
      if (inputs.size === node.inputs.length) {
        // Evaluate with constants
        const outputs = evaluateNode(node, inputs);

        // Store constant outputs
        for (const [portName, value] of outputs) {
          const key = portPathKey({ nodeId: node.id, portName });
          if (!portValues.has(key)) {
            portValues.set(key, value);
            changed = true;
          }
        }
      }
    }
  }

  return circuit; // Optimized version would remove constant nodes
}
```

## Error Conditions

### 1. Combinational Loop

Detected during topological sort. Cannot proceed with evaluation.

### 2. Convergence Failure

If iterative evaluation doesn't stabilize after N iterations (for circuits with latches), report error.

### 3. Invalid State Access

Accessing uninitialized state or out-of-bounds memory address.

## Testing Execution

### Test 1: Simple AND gate

```typescript
const circuit = {
  nodes: [{ id: 'and1', componentRef: 'And', ... }],
  connections: [/* a -> and1.a, b -> and1.b, and1.out -> out */]
};

const result = evaluateCombinational(circuit, new Map([['a', true], ['b', true]]));
assert(result.outputs.get('out') === true);

const result2 = evaluateCombinational(circuit, new Map([['a', true], ['b', false]]));
assert(result2.outputs.get('out') === false);
```

### Test 2: Counter (sequential)

```typescript
const circuit = loadCircuit('Counter8.json');
const sim = new Simulator(circuit);

// Initially 0
let result = sim.step(new Map([['reset', false]]));
assert(result.outputs.get('count') === 0);

// After clock: 1
sim.setClock('clk', true);
result = sim.step(new Map([['reset', false]]));
assert(result.outputs.get('count') === 1);

// After another clock: 2
sim.setClock('clk', false);
sim.setClock('clk', true);
result = sim.step(new Map([['reset', false]]));
assert(result.outputs.get('count') === 2);
```

## Summary

The execution model is:
1. **Deterministic** - no randomness, reproducible results
2. **Efficient** - topological sort, incremental evaluation
3. **Clear** - explicit state management, predictable timing
4. **Debuggable** - step-by-step execution, state inspection

This forms the foundation for reliable circuit simulation in the browser.
