# How to Add a New Primitive Component

This guide shows how to add a new primitive component to the system using the unified primitive interface.

## Modern Architecture (Current)

The system uses a **single-definition architecture** where all primitive components are defined in one place (`primitives.ts`). Each definition includes circuit structure, behavior, UI metadata, and initialization logic. Everything else is automatically generated.

**Core file**: `/src/features/visual-editor/lib/primitive-registry.ts`

**Steps to add a primitive**:
1. Add definition to `PRIMITIVE_DEFINITIONS` using `defineCombinational()` or `defineSequential()`
2. Add enum value to `ComponentType` (for UI compatibility)
3. Write tests

That's it! No manual IR types, no marshalling code, no switch statements.

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

### Step 3: Add to ComponentType enum (types/index.ts)

Add the component type to the `ComponentType` enum for palette compatibility:

```typescript
export type ComponentType =
  | 'SWITCH'
  | 'LED'
  // ... other types ...
  | 'T_FLIP_FLOP';
```

This enum is used for UI palette organization and backwards compatibility.

That's it! Everything else (Circuit IR, evaluator registry, component creation, palette metadata) is automatically generated from your definition.

### Step 4: Test

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

### Define in PRIMITIVE_DEFINITIONS

Add to the `PRIMITIVE_DEFINITIONS` object in `primitives.ts`:

```typescript
Xor3: defineCombinational({
  name: 'Xor3',
  description: '3-input XOR gate - outputs true when odd number of inputs are true',
  category: 'logic-gates',
  icon: '⊕3',
  componentType: 'XOR3_GATE',
  inputs: [
    { name: 'a', portType: bitType() },
    { name: 'b', portType: bitType() },
    { name: 'c', portType: bitType() },
  ],
  outputs: [{ name: 'out', portType: bitType() }],
  evaluate: (inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    const c = inputs.get('c') as boolean;
    return new Map([['out', (a !== b) !== c]]);
  },
}),
```

### Add ComponentType enum

```typescript
// In types/index.ts
export type ComponentType =
  // ...
  | 'XOR3_GATE';
```

That's it! The system automatically generates everything else.

### Test

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

1. **Single source of truth**: Add ONE definition to `PRIMITIVE_DEFINITIONS` - everything else is auto-generated
2. **Use helper functions**: `defineCombinational()` for stateless gates, `defineSequential()` for stateful components
3. **The evaluator defines behavior**: Your `evaluate()` function says what the component does
4. **No manual wiring**: No IR types, no marshalling, no switch statements - it's all automatic
5. **Test in isolation**: Test evaluators directly without involving the full simulator

## Common Patterns

### Combinational Components
- Use `defineCombinational({ ... })` helper
- Provide `evaluate(inputs)` function - compute outputs from inputs
- No clocks or state needed
- Examples: logic gates, arithmetic ops, bus operations

### Sequential Components
- Use `defineSequential({ ... })` helper
- Provide `evaluate(inputs, currentState)` - compute outputs from state
- Provide `updateState(inputs, currentState, clockEdges)` - compute next state
- Declare `clocks` array (e.g., `[{ name: 'clk' }]`)
- Declare `state` array with initial values
- Handle clock edges via `clockEdges['clk']` parameter
- Examples: flip-flops, registers, RAM

### Multi-bit Components (Bus)
- Use `busType(width)` instead of `bitType()` for ports
- Values are `number` instead of `boolean`
- Example: `const data = inputs.get('data') as number;`
- Handle bit width masking if needed (e.g., `(value + 1) & 0xFF`)

### Components with Multiple Clocks
- Declare multiple clocks: `clocks: [{ name: 'clk1' }, { name: 'clk2' }]`
- Access edges separately: `clockEdges['clk1']`, `clockEdges['clk2']`

### What Gets Auto-Generated
From your single definition, the system generates:
- Circuit IR structure (`PRIMITIVES` array)
- Evaluator registration (`PRIMITIVE_EVALUATORS` object)
- Component creator function (via `createPrimitiveComponent`)
- Palette metadata (category, icon, component type)
- All port mappings and type information
