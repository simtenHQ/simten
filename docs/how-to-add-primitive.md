# How to Add a New Primitive Component

This guide shows how to add a new primitive component to the system using the unified primitive interface.

## Example: Adding a T Flip-Flop

A T (Toggle) Flip-Flop toggles its output on each rising clock edge when T input is high.

### Step 1: Define the Primitive Circuit

Add to `primitives.ts` in the `PRIMITIVES` array:

```typescript
createPrimitiveCircuit(
  'TFlipFlop',
  [
    { name: 't', portType: bitType() },     // Toggle input
    { name: 'clk', portType: bitType() },   // Clock input
  ],
  [
    { name: 'q', portType: bitType() },     // Output
    { name: 'q_bar', portType: bitType() }, // Inverted output
  ],
  'T Flip-Flop - toggles output on rising clock edge when T is high'
)
```

### Step 2: Implement the Evaluator

Add to `PRIMITIVE_EVALUATORS` in `primitives.ts`:

```typescript
TFlipFlop: createSequentialEvaluator(
  // Evaluate: Return outputs based on current state
  (inputs, currentState) => {
    const state = (currentState ?? false) as boolean;
    return new Map([
      ['q', state],
      ['q_bar', !state],
    ]);
  },
  // UpdateState: Toggle state on rising edge when T is high
  (inputs, currentState, clockEdges) => {
    const t = inputs.get('t') as boolean;
    const edge = clockEdges['clk'] ?? 'none';
    const currentValue = (currentState ?? false) as boolean;

    // Toggle on rising edge when T is high
    if (edge === 'rising' && t) {
      return !currentValue;
    }

    // Otherwise, keep current state
    return currentValue;
  }
)
```

### Step 3: Add to Component Type Mapping (Simulator)

If using the old IR (lib/simulator.ts), add to the type mapping:

```typescript
function getComponentTypeToPrimitiveName(type: ComponentType): string | null {
  const mapping: Record<string, string> = {
    // ... existing mappings ...
    'T_FLIP_FLOP': 'TFlipFlop',
  };
  return mapping[type] ?? null;
}
```

### Step 4: Add IR Type (Old IR Only)

If using the old IR (types/ir.ts), add the component type:

```typescript
export type PrimitiveComponentType =
  | 'SWITCH'
  | 'LED'
  // ... other types ...
  | 'T_FLIP_FLOP';

export interface TFlipFlopComponent extends ComponentBase {
  type: 'T_FLIP_FLOP';
  state: boolean; // Current stored value
}

export type Component =
  | SwitchComponent
  | LEDComponent
  // ... other types ...
  | TFlipFlopComponent;
```

And add the spec:

```typescript
T_FLIP_FLOP: {
  type: 'T_FLIP_FLOP',
  inputCount: 2,  // T, CLK
  outputCount: 2, // Q, Q_BAR
},
```

And update the helper:

```typescript
export function isSequentialComponent(type: ComponentType): boolean {
  return type === 'D_FLIP_FLOP' || type === 'REGISTER' || type === 'RAM' || type === 'T_FLIP_FLOP';
}
```

### Step 5: Add Marshalling Logic (Simulator)

In `evaluateComponent()` in lib/simulator.ts:

```typescript
if (component.type === 'T_FLIP_FLOP') {
  // T Flip-Flop: inputs are [t, clk]
  inputMap.set('t', inputValues[0] ?? false);
  inputMap.set('clk', inputValues[1] ?? false);
}

// ... later in output conversion ...

if (component.type === 'T_FLIP_FLOP') {
  const q = outputMap.get('q') as boolean;
  const qBar = outputMap.get('q_bar') as boolean;
  return [q, qBar];
}
```

In `updateSequentialStates()`:

```typescript
if (component.type === 'T_FLIP_FLOP') {
  const t = inputs[0] ?? false;
  const clk = inputs[1] ?? false;
  inputMap.set('t', t);
  inputMap.set('clk', clk);

  // Update clock signal state
  let clockSignal = seqState.clocks.get(`${compId}.clk`);
  if (!clockSignal) {
    clockSignal = { previousValue: clk, currentValue: clk };
    seqState.clocks.set(`${compId}.clk`, clockSignal);
  } else {
    clockSignal.previousValue = clockSignal.currentValue;
    clockSignal.currentValue = clk;
  }

  const edge = detectClockEdge(clockSignal);
  const clockEdges: ClockEdges = { 'clk': edge };

  const currentState = seqState.currentState.get(compId);
  const nextState = evaluator.updateState(inputMap, currentState, clockEdges);
  seqState.nextState.set(compId, nextState);
}
```

In `initializeSequentialState()`:

```typescript
if (component.type === 'T_FLIP_FLOP' && 'state' in component) {
  currentState.set(compId, component.state);
  nextState.set(compId, component.state);
}
```

### Step 6: Test

Create tests in `primitives.test.ts`:

```typescript
describe('Sequential Components', () => {
  describe('T Flip-Flop', () => {
    it('should toggle on rising edge when T is high', () => {
      const evaluator = PRIMITIVE_EVALUATORS.TFlipFlop;

      // Initial state: false
      let state: boolean = false;

      // First rising edge with T=true
      const inputs1 = new Map([['t', true], ['clk', true]]);
      const clockEdges1 = { 'clk': 'rising' as const };
      state = evaluator.updateState!(inputs1, state, clockEdges1) as boolean;
      expect(state).toBe(true); // Toggled to true

      // Second rising edge with T=true
      const inputs2 = new Map([['t', true], ['clk', true]]);
      const clockEdges2 = { 'clk': 'rising' as const };
      state = evaluator.updateState!(inputs2, state, clockEdges2) as boolean;
      expect(state).toBe(false); // Toggled back to false
    });

    it('should not toggle when T is low', () => {
      const evaluator = PRIMITIVE_EVALUATORS.TFlipFlop;

      let state: boolean = false;

      const inputs = new Map([['t', false], ['clk', true]]);
      const clockEdges = { 'clk': 'rising' as const };
      state = evaluator.updateState!(inputs, state, clockEdges) as boolean;
      expect(state).toBe(false); // No toggle
    });

    it('should output current state', () => {
      const evaluator = PRIMITIVE_EVALUATORS.TFlipFlop;

      const inputs = new Map([['t', true], ['clk', false]]);

      const outputs1 = evaluator.evaluate(inputs, false);
      expect(outputs1.get('q')).toBe(false);
      expect(outputs1.get('q_bar')).toBe(true);

      const outputs2 = evaluator.evaluate(inputs, true);
      expect(outputs2.get('q')).toBe(true);
      expect(outputs2.get('q_bar')).toBe(false);
    });
  });
});
```

## Combinational Component Example: XOR3

A 3-input XOR gate.

### Step 1-2: Define and Implement

```typescript
// In PRIMITIVES array
createPrimitiveCircuit(
  'Xor3',
  [
    { name: 'a', portType: bitType() },
    { name: 'b', portType: bitType() },
    { name: 'c', portType: bitType() },
  ],
  [{ name: 'out', portType: bitType() }],
  '3-input XOR gate - outputs true when odd number of inputs are true'
)

// In PRIMITIVE_EVALUATORS
Xor3: createCombinationalEvaluator((inputs) => {
  const a = inputs.get('a') as boolean;
  const b = inputs.get('b') as boolean;
  const c = inputs.get('c') as boolean;
  return new Map([['out', (a !== b) !== c]]);
})
```

### Step 3-4: Add to Type System

```typescript
// In types/ir.ts
export type PrimitiveComponentType =
  // ...
  | 'XOR3_GATE';

export interface Xor3GateComponent extends ComponentBase {
  type: 'XOR3_GATE';
}

// In COMPONENT_SPECS
XOR3_GATE: {
  type: 'XOR3_GATE',
  inputCount: 3,
  outputCount: 1,
  evaluate: undefined, // Will use evaluator from primitives
},
```

### Step 5: Add Marshalling

```typescript
// In evaluateComponent()
else {
  // Three-input gates
  inputMap.set('a', inputValues[0] ?? false);
  inputMap.set('b', inputValues[1] ?? false);
  inputMap.set('c', inputValues[2] ?? false);
}
```

### Step 6: Test

```typescript
it('should evaluate XOR3 gate correctly', () => {
  const evaluator = PRIMITIVE_EVALUATORS.Xor3;

  expect(evaluator.evaluate(new Map([['a', false], ['b', false], ['c', false]]))).toEqual(
    new Map([['out', false]])
  );
  expect(evaluator.evaluate(new Map([['a', true], ['b', false], ['c', false]]))).toEqual(
    new Map([['out', true]])
  );
  expect(evaluator.evaluate(new Map([['a', true], ['b', true], ['c', false]]))).toEqual(
    new Map([['out', false]])
  );
  expect(evaluator.evaluate(new Map([['a', true], ['b', true], ['c', true]]))).toEqual(
    new Map([['out', true]])
  );
});
```

## Key Takeaways

1. **All logic lives in primitives.ts**: The evaluator defines what the component does
2. **Simulator handles orchestration**: When to evaluate, when to update state
3. **Marshalling is separate**: Converting between array and map interfaces
4. **Testing in isolation**: Test evaluators without involving the simulator
5. **Clean separation**: WHAT (primitive) vs WHEN (simulator) vs WHERE (IR)

## Common Patterns

### Combinational Components
- Use `createCombinationalEvaluator()`
- Implement only `evaluate(inputs)`
- No state management needed

### Sequential Components
- Use `createSequentialEvaluator()`
- Implement `evaluate(inputs, currentState)` for outputs
- Implement `updateState(inputs, currentState, clockEdges)` for state transitions
- Handle clock edges via `clockEdges` parameter

### Multi-bit Components (Bus)
- Use `BusValue` (number) instead of `BitValue` (boolean)
- Example: `const data = inputs.get('data') as number;`
- Handle bit width masking if needed

### Components with Multiple Clocks
- Build `clockEdges` with multiple keys:
  ```typescript
  const clockEdges: ClockEdges = {
    'clk1': edge1,
    'clk2': edge2,
  };
  ```
