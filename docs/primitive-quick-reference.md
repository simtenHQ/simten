# Primitive Components - Quick Reference

## For Developers: Adding a New Primitive

### 1. Define the Evaluator (`primitives.ts`)

```typescript
export const PRIMITIVE_EVALUATORS = {
  // ... existing evaluators

  MyNewComponent: createCombinationalEvaluator((inputs) => {
    const inputA = inputs.get('a') as number;
    const inputB = inputs.get('b') as number;
    const result = inputA + inputB; // your logic here
    return new Map([['out', result]]);
  }),
};
```

For sequential components:
```typescript
MySequentialComponent: createSequentialEvaluator(
  // Evaluate: Return outputs based on current state
  (inputs, currentState) => {
    const state = (currentState ?? 0) as number;
    return new Map([['q', state]]);
  },
  // UpdateState: Update state based on inputs and clock edges
  (inputs, currentState, clockEdges) => {
    const data = inputs.get('data') as number;
    const edge = clockEdges['clk'] ?? 'none';

    if (edge === 'rising') {
      return data;
    }
    return currentState;
  }
),
```

### 2. Add to PRIMITIVES Array (`primitives.ts`)

```typescript
export const PRIMITIVES: Circuit[] = [
  // ... existing primitives

  createPrimitiveCircuit(
    'MyNewComponent',
    [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    [{ name: 'out', portType: busType(8) }],
    'Description of what this component does'
  ),
];
```

### 3. Add Initial State (if needed) (`primitives.ts`)

Only needed if your component has state (value, width, memory, etc.):

```typescript
export function createPrimitiveComponent(id, type, initialValue) {
  // ...
  switch (type) {
    // ... existing cases

    case 'MyNewComponent':
      component.value = initialValue ?? 0;
      component.width = 8;
      break;
  }
  // ...
}
```

### 4. Add UI Metadata (`primitive-metadata.ts`)

```typescript
export const PRIMITIVE_METADATA = {
  // ... existing metadata

  MyNewComponent: {
    category: PRIMITIVE_CATEGORIES.UTILITIES,
    icon: '🆕',
    componentType: 'MyNewComponent',
  },
};
```

### 5. Write Tests (`primitives.test.ts`)

```typescript
describe('MyNewComponent', () => {
  it('should evaluate correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.MyNewComponent;
    const result = evaluator.evaluate(new Map([['a', 5], ['b', 3]]));
    expect(result.get('out')).toBe(8);
  });

  it('should create with correct initial state', () => {
    const component = createPrimitiveComponent('test-id', 'MyNewComponent');
    expect(component).toEqual({
      id: 'test-id',
      type: 'MyNewComponent',
      value: 0,
      width: 8,
    });
  });
});
```

## Common Patterns

### Combinational Logic (No State)

```typescript
// 1. Evaluator
MyGate: createCombinationalEvaluator((inputs) => {
  const a = inputs.get('a') as boolean;
  const b = inputs.get('b') as boolean;
  return new Map([['out', a && b]]);
}),

// 2. Circuit definition
createPrimitiveCircuit(
  'MyGate',
  [
    { name: 'a', portType: bitType() },
    { name: 'b', portType: bitType() },
  ],
  [{ name: 'out', portType: bitType() }],
  'Description'
),

// 3. No initial state needed (just id and type)
```

### Input/Output Component (User-Controlled)

```typescript
// 1. Evaluator (returns default or controlled value)
MyInput: createCombinationalEvaluator((inputs) => {
  const value = inputs.get('__value') as number ?? 0;
  return new Map([['out', value]]);
}),

// 2. Circuit definition
createPrimitiveCircuit(
  'MyInput',
  [],
  [{ name: 'out', portType: busType(8) }],
  'User-controlled input'
),

// 3. Initial state with value
case 'MyInput':
  component.value = initialValue ?? 0;
  component.width = 8;
  break;
```

### Display Component (No Outputs)

```typescript
// 1. Evaluator (no outputs)
MyDisplay: createCombinationalEvaluator((inputs) => {
  // Display components don't produce outputs
  return new Map();
}),

// 2. Circuit definition
createPrimitiveCircuit(
  'MyDisplay',
  [{ name: 'in', portType: busType(8) }],
  [], // No outputs
  'Display component'
),

// 3. Initial state for display value
case 'MyDisplay':
  component.value = 0;
  break;
```

### Sequential Component (Stateful)

```typescript
// 1. Evaluator
MyRegister: createSequentialEvaluator(
  (inputs, currentState) => {
    const state = (currentState ?? 0) as number;
    return new Map([['q', state]]);
  },
  (inputs, currentState, clockEdges) => {
    const data = inputs.get('data') as number;
    const we = inputs.get('we') as boolean;
    const edge = clockEdges['clk'] ?? 'none';

    if (edge === 'rising' && we) {
      return data;
    }
    return currentState;
  }
),

// 2. Circuit definition
createPrimitiveCircuit(
  'MyRegister',
  [
    { name: 'data', portType: busType(8) },
    { name: 'we', portType: bitType() },
    { name: 'clk', portType: bitType() },
  ],
  [{ name: 'q', portType: busType(8) }],
  'Clocked register'
),

// 3. Initial state with state field
case 'MyRegister':
  component.width = 8;
  component.state = 0;
  break;
```

### Parameterized Component

```typescript
// 1. Evaluator (gets params from inputs map)
MyParameterized: createCombinationalEvaluator((inputs) => {
  const width = inputs.get('__width') as number ?? 8;
  const value = inputs.get('in') as number;
  const mask = (1 << width) - 1;
  return new Map([['out', value & mask]]);
}),

// 2. Circuit definition (default parameters shown)
createPrimitiveCircuit(
  'MyParameterized',
  [{ name: 'in', portType: busType(8) }],
  [{ name: 'out', portType: busType(8) }],
  'Parameterized by width'
),

// 3. Initial state with parameter
case 'MyParameterized':
  component.width = 8; // Default width
  break;
```

## Port Types

```typescript
import { bitType, busType } from '../types/ir-v0.1';

// Single bit (boolean)
{ name: 'enable', portType: bitType() }

// Multi-bit bus (number)
{ name: 'data', portType: busType(8) }   // 8-bit bus
{ name: 'addr', portType: busType(16) }  // 16-bit bus
```

## Component Categories

```typescript
PRIMITIVE_CATEGORIES.LOGIC_GATES    // Basic logic gates
PRIMITIVE_CATEGORIES.ARITHMETIC     // Math operations
PRIMITIVE_CATEGORIES.PLEXERS        // Mux/Decoder
PRIMITIVE_CATEGORIES.SEQUENTIAL     // Flip-flops, registers
PRIMITIVE_CATEGORIES.MEMORY         // RAM, ROM
PRIMITIVE_CATEGORIES.UTILITIES      // Helper components
PRIMITIVE_CATEGORIES.IO             // Input/Output
PRIMITIVE_CATEGORIES.BUS_OPS        // Bus operations
PRIMITIVE_CATEGORIES.DISPLAY        // Display components
```

## Special Input Parameters

These can be passed in the inputs Map for parameterized components:

```typescript
'__width'         // Bit width for parameterized components
'__value'         // Initial/current value for input components
'__input_count'   // Number of inputs for Mux
'__input_width'   // Input width for Decoder
'__widths_out'    // Output widths for Splitter
```

## Naming Conventions

- **Component Names**: PascalCase (e.g., `MyNewComponent`, `HexDisplay`)
- **Port Names**: snake_case (e.g., `data_in`, `carry_out`, `q_bar`)
- **Special Parameters**: __snake_case with double underscore (e.g., `__width`, `__value`)

## Testing Checklist

- [ ] Evaluator logic is correct
- [ ] Circuit definition has correct ports
- [ ] Initial state is proper (if stateful)
- [ ] Metadata has icon and category
- [ ] Tests cover normal cases
- [ ] Tests cover edge cases
- [ ] Component can be created via `createPrimitiveComponent()`
- [ ] Component works in simulation

## Common Pitfalls

### 1. Forgetting to Add to PRIMITIVES Array
```typescript
// ❌ Only added evaluator, forgot circuit definition
PRIMITIVE_EVALUATORS.MyComponent = ...

// ✅ Must also add to PRIMITIVES array
PRIMITIVES = [..., createPrimitiveCircuit('MyComponent', ...)]
```

### 2. Mismatched Port Names
```typescript
// ❌ Evaluator uses 'a', circuit uses 'input_a'
createCombinationalEvaluator((inputs) => {
  const a = inputs.get('a');  // Won't find it!
})

createPrimitiveCircuit('MyGate', [{ name: 'input_a', ... }], ...)

// ✅ Use same names
createCombinationalEvaluator((inputs) => {
  const a = inputs.get('a');
})

createPrimitiveCircuit('MyGate', [{ name: 'a', ... }], ...)
```

### 3. Wrong Port Types
```typescript
// ❌ Boolean where number expected
const value = inputs.get('data') as boolean; // data is a bus!

// ✅ Match port type
const value = inputs.get('data') as number; // for busType()
const enable = inputs.get('en') as boolean; // for bitType()
```

### 4. Forgetting State in Component Creation
```typescript
// ❌ Component needs state but not in createPrimitiveComponent
// Will get { id, type } only

// ✅ Add state initialization
case 'MyComponent':
  component.state = 0;
  break;
```

## Quick Decision Tree

**Does your component have outputs?**
- No → It's a display component (return empty Map)
- Yes → Continue

**Does your component have state?**
- No → Use `createCombinationalEvaluator`
- Yes → Use `createSequentialEvaluator`

**Is the state user-controlled?**
- Yes → Handle `__value` parameter in evaluator
- No → State updates based on inputs/clocks

**Does it need width/parameters?**
- Yes → Handle `__width` etc. in evaluator, add to component creation
- No → Minimal initial state (just id and type)

## Examples to Copy From

- **Simple Gate**: Look at `And` in primitives.ts
- **Display**: Look at `HexDisplay` or `SevenSegment`
- **Input**: Look at `Input` or `Button`
- **Sequential**: Look at `DFlipFlop` or `Register`
- **Parameterized**: Look at `Adder` or `Multiplier`
- **Utility**: Look at `Splitter` or `Probe`

## Resources

- [Full Architecture Documentation](./architecture-primitive-components.md)
- [Refactor Summary](./refactor-primitive-architecture-summary.md)
- [Verification Checklist](./primitive-refactor-checklist.md)
- [Primitive Interface](../src/features/visual-editor/lib/primitive-interface.ts)
